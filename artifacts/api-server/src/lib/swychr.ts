const PAYIN_BASE  = "https://api.accountpe.com/api/payin";
const PAYOUT_BASE = "https://api.accountpe.com/api/payout";
const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes

const ACCOUNTPE = {
  email: process.env.SWYCHR_USERNAME || "",
  password: process.env.SWYCHR_PASSWORD || "",
  webhookSecret: process.env.SWYCHR_WEBHOOK_SECRET || "",
};

// ── Pay-in token cache ──────────────────────────────────────────────
let tokenCache: {
  token: string | null;
  expiresAt: number | null;
  inFlight: Promise<string> | null;
} = { token: null, expiresAt: null, inFlight: null };

export async function getAccountPeToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now + 120_000) {
    return tokenCache.token;
  }
  if (tokenCache.inFlight) {
    return tokenCache.inFlight;
  }

  tokenCache.inFlight = (async () => {
    try {
      console.log("[AccountPE] Auth payin →", `${PAYIN_BASE}/admin/auth`);
      const res = await fetch(`${PAYIN_BASE}/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ACCOUNTPE.email, password: ACCOUNTPE.password }),
      });

      const rawText = await res.text();
      console.log("[AccountPE] Auth payin status:", res.status, "body:", rawText.slice(0, 200));

      if (!res.ok) throw new Error(`AccountPE auth échoué: status ${res.status} — ${rawText.slice(0, 150)}`);

      const data = JSON.parse(rawText) as Record<string, unknown>;
      const token = data.token as string | undefined;
      if (!token) throw new Error(`AccountPE: pas de token dans la réponse — ${rawText.slice(0, 150)}`);

      tokenCache.token = token;
      tokenCache.expiresAt = now + TOKEN_TTL_MS;
      console.log("[AccountPE] Token payin obtenu ✅");
      return token;
    } finally {
      tokenCache.inFlight = null;
    }
  })();

  return tokenCache.inFlight;
}

export function invalidateToken() {
  tokenCache.token = null;
  tokenCache.expiresAt = null;
}

// ── Payout token cache ──────────────────────────────────────────────
let payoutTokenCache: {
  token: string | null;
  expiresAt: number | null;
  inFlight: Promise<string> | null;
} = { token: null, expiresAt: null, inFlight: null };

export async function getPayoutToken(): Promise<string> {
  const now = Date.now();

  if (payoutTokenCache.token && payoutTokenCache.expiresAt && payoutTokenCache.expiresAt > now + 120_000) {
    return payoutTokenCache.token;
  }
  if (payoutTokenCache.inFlight) {
    return payoutTokenCache.inFlight;
  }

  payoutTokenCache.inFlight = (async () => {
    try {
      console.log("[AccountPE] Auth payout →", `${PAYOUT_BASE}/admin/auth`);
      const res = await fetch(`${PAYOUT_BASE}/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ACCOUNTPE.email, password: ACCOUNTPE.password }),
      });

      const rawText = await res.text();
      console.log("[AccountPE] Auth payout status:", res.status, "body:", rawText.slice(0, 200));

      if (!res.ok) throw new Error(`AccountPE payout auth échoué: status ${res.status} — ${rawText.slice(0, 150)}`);

      const data = JSON.parse(rawText) as Record<string, unknown>;
      const token = data.token as string | undefined;
      if (!token) throw new Error(`AccountPE payout: pas de token — ${rawText.slice(0, 150)}`);

      payoutTokenCache.token = token;
      payoutTokenCache.expiresAt = now + TOKEN_TTL_MS;
      console.log("[AccountPE] Token payout obtenu ✅");
      return token;
    } finally {
      payoutTokenCache.inFlight = null;
    }
  })();

  return payoutTokenCache.inFlight;
}

export function invalidatePayoutToken() {
  payoutTokenCache.token = null;
  payoutTokenCache.expiresAt = null;
}

// ── Pay-in : créer un lien de paiement ─────────────────────────────
export async function createPaymentLink(params: {
  countryCode: string;
  name: string;
  email: string;
  mobile: string;
  amount: number;
  currency: string;
  transactionId: string;
  description: string;
  callbackUrl: string;
}): Promise<{ paymentLink: string; id: string }> {
  let token = await getAccountPeToken();

  const body = {
    country_code:        params.countryCode,
    name:                params.name,
    email:               params.email,
    mobile:              params.mobile.replace(/\D/g, ""),
    amount:              params.amount,
    currency:            params.currency,
    transaction_id:      params.transactionId,
    description:         params.description,
    pass_digital_charge: true,
    callback_url:        params.callbackUrl,
  };

  console.log("[AccountPE] createPaymentLink →", JSON.stringify({ ...body, email: "***" }));

  async function call(tok: string): Promise<Response> {
    return fetch(`${PAYIN_BASE}/create_payment_links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    });
  }

  let res = await call(token);

  if (res.status === 401) {
    invalidateToken();
    token = await getAccountPeToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] createPaymentLink status:", res.status, "body:", rawText.slice(0, 300));

  if (!res.ok) throw new Error(`AccountPE createPaymentLink échoué: status ${res.status} — ${rawText.slice(0, 200)}`);

  const data = JSON.parse(rawText) as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? data;

  const paymentLink = (
    inner.payment_link || inner.paymentLink || inner.checkout_url || data.payment_link
  ) as string | undefined;

  const id = (inner.id || inner.paymentId || params.transactionId) as string;

  if (!paymentLink) {
    throw new Error(`AccountPE: pas de payment_link dans la réponse — ${rawText.slice(0, 200)}`);
  }

  return { paymentLink, id };
}

// ── Pay-in : vérifier le statut d'un paiement ──────────────────────
export async function checkPaymentStatus(transactionId: string): Promise<{
  status: "pending" | "success" | "failed" | "refunded";
  raw: number | string;
}> {
  let token = await getAccountPeToken();

  async function call(tok: string): Promise<Response> {
    return fetch(`${PAYIN_BASE}/payment_link_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
  }

  let res = await call(token);
  if (res.status === 401) {
    invalidateToken();
    token = await getAccountPeToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] checkPaymentStatus:", transactionId, "status:", res.status, "body:", rawText.slice(0, 300));

  const data = JSON.parse(rawText) as Record<string, unknown>;

  const inner = (data.data as Record<string, unknown>) ?? {};
  const nested = (inner.data as Record<string, unknown>) ?? {};
  const attrs = (nested.attributes as Record<string, unknown>) ?? {};

  const rawStatus = attrs.status ?? inner.status ?? data.status ?? "unknown";

  const STATUS_MAP: Record<number, "pending" | "success" | "failed" | "refunded"> = {
    0: "pending",
    1: "success",
    2: "failed",
    3: "refunded",
  };

  let normalized: "pending" | "success" | "failed" | "refunded";
  if (typeof rawStatus === "number") {
    normalized = STATUS_MAP[rawStatus] ?? "pending";
  } else {
    const s = String(rawStatus).toLowerCase();
    if (s === "success" || s === "paid" || s === "completed") normalized = "success";
    else if (s === "failed" || s === "cancelled" || s === "expired" || s === "rejected") normalized = "failed";
    else if (s === "refunded") normalized = "refunded";
    else normalized = "pending";
  }

  return { status: normalized, raw: rawStatus as number | string };
}

// ── Payout : lister les méthodes disponibles pour un pays ──────────
export interface PayoutMethod {
  id: string;
  name: string;
  country: string;
}

// Cache mémoire 5 min pour éviter trop d'appels
const payoutMethodsCache: Record<string, { methods: PayoutMethod[]; expiresAt: number }> = {};

export async function getPayoutMethods(countryCode: string): Promise<PayoutMethod[]> {
  const now = Date.now();
  const cached = payoutMethodsCache[countryCode];
  if (cached && cached.expiresAt > now) {
    return cached.methods;
  }

  let token = await getPayoutToken();

  async function call(tok: string): Promise<Response> {
    return fetch(`${PAYOUT_BASE}/payout_methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ country_code: countryCode }),
    });
  }

  let res = await call(token);
  if (res.status === 401) {
    invalidatePayoutToken();
    token = await getPayoutToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] getPayoutMethods:", countryCode, "status:", res.status, "body:", rawText.slice(0, 400));

  if (!res.ok) throw new Error(`AccountPE getPayoutMethods échoué: status ${res.status} — ${rawText.slice(0, 200)}`);

  const data = JSON.parse(rawText) as Record<string, unknown>;
  const arr = (data.data as PayoutMethod[]) ?? [];

  payoutMethodsCache[countryCode] = { methods: arr, expiresAt: now + 5 * 60 * 1000 };
  return arr;
}

// ── Payout : créer un virement vers le membre ──────────────────────
// Frais : 550 FCFA déduits du montant avant envoi à AccountPE.
// Ex : membre demande 3100 → on envoie 2550 à AccountPE.
export const PAYOUT_FEE = 550;
export const PAYOUT_MIN = 3100; // minimum côté TRIXHUB (3100 - 550 = 2550 envoyé)

export async function createPayout(params: {
  countryCode: string;
  name: string;
  email: string;
  mobile: string;
  amount: number;       // montant DEMANDÉ par le membre (avant déduction frais)
  currency: string;
  transactionId: string;
  payoutMethod: string; // id AccountPE (ex: "mtn_cm")
  description: string;
}): Promise<{ id: string; status: "pending" | "success" | "failed" }> {
  let token = await getPayoutToken();

  const amountToSend = Math.max(0, params.amount - PAYOUT_FEE);

  const body = {
    country_code:   params.countryCode,
    name:           params.name,
    email:          params.email,
    mobile:         params.mobile.replace(/\D/g, ""),
    amount:         amountToSend,
    currency:       params.currency,
    transaction_id: params.transactionId,
    payout_method:  params.payoutMethod,
    description:    params.description,
  };

  console.log("[AccountPE] createPayout →", JSON.stringify({ ...body, email: "***" }));

  async function call(tok: string): Promise<Response> {
    return fetch(`${PAYOUT_BASE}/create_payout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    });
  }

  let res = await call(token);
  if (res.status === 401) {
    invalidatePayoutToken();
    token = await getPayoutToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] createPayout status:", res.status, "body:", rawText.slice(0, 400));

  if (!res.ok) throw new Error(`AccountPE createPayout échoué: status ${res.status} — ${rawText.slice(0, 200)}`);

  const data = JSON.parse(rawText) as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? data;

  const id = (inner.id || inner.payoutId || params.transactionId) as string;
  const rawStatus = (inner.status ?? 0) as number;

  const statusMap: Record<number, "pending" | "success" | "failed"> = {
    0: "pending",
    1: "success",
    2: "failed",
  };
  const status = statusMap[rawStatus] ?? "pending";

  return { id, status };
}

// ── Payout : vérifier le statut d'un payout ───────────────────────
export async function checkPayoutStatus(transactionId: string): Promise<{
  status: "pending" | "success" | "failed";
  raw: number | string;
}> {
  let token = await getPayoutToken();

  async function call(tok: string): Promise<Response> {
    return fetch(`${PAYOUT_BASE}/payout_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
  }

  let res = await call(token);
  if (res.status === 401) {
    invalidatePayoutToken();
    token = await getPayoutToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] checkPayoutStatus:", transactionId, "status:", res.status, "body:", rawText.slice(0, 300));

  const data = JSON.parse(rawText) as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? {};
  const attrs = (inner.attributes as Record<string, unknown>) ?? {};
  const rawStatus = attrs.status ?? inner.status ?? data.status ?? 0;

  const statusMap: Record<number, "pending" | "success" | "failed"> = {
    0: "pending",
    1: "success",
    2: "failed",
  };

  let normalized: "pending" | "success" | "failed";
  if (typeof rawStatus === "number") {
    normalized = statusMap[rawStatus] ?? "pending";
  } else {
    const s = String(rawStatus).toLowerCase();
    if (s === "success" || s === "paid" || s === "completed") normalized = "success";
    else if (s === "failed" || s === "cancelled" || s === "expired" || s === "rejected") normalized = "failed";
    else normalized = "pending";
  }

  return { status: normalized, raw: rawStatus as number | string };
}

// ── Webhook (pay-in uniquement) ────────────────────────────────────
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!ACCOUNTPE.webhookSecret || !signature) return true;
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto.createHmac("sha256", ACCOUNTPE.webhookSecret).update(rawBody).digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

export function getWebhookUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS || "").split(",");
  const prod = domains.find(d => d.includes("trixhub.site")) || domains[0] || "";
  const domain = prod || process.env.REPLIT_DEV_DOMAIN || "";
  return domain ? `https://${domain}/api/accountpe/webhook` : "";
}

// Mapping pays → code AccountPE
export const COUNTRY_CODES: Record<string, string> = {
  "Bénin": "BJ", "Burkina Faso": "BF", "Cameroun": "CM",
  "Côte d'Ivoire": "CI", "Congo-Brazzaville": "CG", "RD Congo": "CD",
  "Gabon": "GA", "Ghana": "GH", "Guinée": "GN", "Kenya": "KE",
  "Mali": "ML", "Niger": "NE", "Nigeria": "NG",
  "Rwanda": "RW", "Sénégal": "SN", "Togo": "TG", "Tanzanie": "TZ",
  "Ouganda": "UG",
};

export { ACCOUNTPE };
