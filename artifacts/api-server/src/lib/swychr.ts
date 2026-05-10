const PAYIN_BASE  = "https://api.accountpe.com/api/payin";
const PAYOUT_BASE = "https://api.accountpe.com/api/payout";
const TOKEN_TTL_MS = 25 * 60 * 1000;       // 25 minutes
const FETCH_TIMEOUT_MS = 10_000;            // 10 secondes max par appel HTTP (auth, status, etc.)
const PAYOUT_TIMEOUT_MS = 45_000;           // 45 secondes pour create_transaction (AccountPE peut être lent)
const METHODS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes pour les méthodes

const ACCOUNTPE = {
  email: process.env.SWYCHR_USERNAME || "",
  password: process.env.SWYCHR_PASSWORD || "",
  webhookSecret: process.env.SWYCHR_WEBHOOK_SECRET || "",
};

// ── Helper : fetch avec timeout ─────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

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
      const res = await fetchWithTimeout(`${PAYIN_BASE}/admin/auth`, {
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
      const res = await fetchWithTimeout(`${PAYOUT_BASE}/admin/auth`, {
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
    return fetchWithTimeout(`${PAYIN_BASE}/create_payment_links`, {
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
    return fetchWithTimeout(`${PAYIN_BASE}/payment_link_status`, {
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
  mobileFormat?: string;
}

// Cache mémoire 30 min — survit à tous les appels de la session serveur
const payoutMethodsCache: Record<string, { methods: PayoutMethod[]; expiresAt: number }> = {};

export async function getPayoutMethods(countryCode: string): Promise<PayoutMethod[]> {
  const now = Date.now();
  const cached = payoutMethodsCache[countryCode];
  if (cached && cached.expiresAt > now) {
    return cached.methods;
  }

  let token = await getPayoutToken();

  async function call(tok: string): Promise<Response> {
    return fetchWithTimeout(`${PAYOUT_BASE}/payout_methods`, {
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

  // L'API AccountPE retourne l'un ou l'autre des formats selon la version :
  //
  // Format "objet" (documenté dans le guide et utilisé actuellement) :
  //   { data: { country, payment_methods: [{ payment_method: "MTN", mobile_format: "6XXXXXXXX" }] } }
  //
  // Format "tableau" (ancienne documentation) :
  //   { data: [{ id: "mtn_cm", name: "MTN Mobile Money", country: "CM" }] }
  //
  // On gère les deux.
  let arr: PayoutMethod[] = [];

  if (Array.isArray(data.data)) {
    // Format tableau : data.data est le tableau directement
    const rawArr = data.data as Array<Record<string, string>>;
    arr = rawArr
      .filter(m => m.id || m.payment_method)
      .map(m => ({
        id:           (m.id || m.payment_method || "").trim(),
        name:         (m.name || m.payment_method || m.id || "").trim(),
        country:      m.country || countryCode,
        mobileFormat: m.mobile_format ?? undefined,
      }));
  } else {
    // Format objet : { data: { payment_methods: [...] } }
    const inner = (data.data as Record<string, unknown>) ?? {};
    const rawMethods = (inner.payment_methods as Array<Record<string, string>>) ?? [];
    arr = rawMethods
      .filter(m => m.payment_method)
      .map(m => ({
        id:           (m.payment_method || "").trim(),
        name:         (m.payment_method || "").trim(),
        country:      countryCode,
        mobileFormat: m.mobile_format ?? undefined,
      }));
  }

  // Filtrer les entrées avec ID vide (données corrompues)
  arr = arr.filter(m => m.id.length > 0);

  console.log("[AccountPE] getPayoutMethods:", countryCode, "→", arr.length, "méthodes:", arr.map(m => m.id).join(", "));
  payoutMethodsCache[countryCode] = { methods: arr, expiresAt: now + METHODS_CACHE_TTL_MS };
  return arr;
}

// ── Warmup au démarrage du serveur ─────────────────────────────────
// Pré-chauffe les tokens et les méthodes pour les pays les plus utilisés
// afin que le premier utilisateur n'attende pas.
const WARMUP_COUNTRIES = ["CM", "CI", "SN", "ML", "BF", "TG", "BJ", "GN"];

export async function warmupServices(): Promise<void> {
  try {
    await Promise.allSettled([
      getPayoutToken().catch(() => {}),
      getAccountPeToken().catch(() => {}),
    ]);
    // Pre-cache methods pour les pays communs (en parallèle, sans bloquer)
    void Promise.allSettled(
      WARMUP_COUNTRIES.map(cc => getPayoutMethods(cc).catch(() => {}))
    );
    console.log("[AccountPE] Warmup terminé ✅");
  } catch {
    console.warn("[AccountPE] Warmup partiel — l'API sera contactée à la première demande");
  }
}

// ── Barème de frais progressif (en FCFA, basé sur le montant demandé) ──────
// < 10 000 FCFA         → 550 FCFA
// 10 000 – 19 999       → 750 FCFA
// 20 000 – 49 999       → 1 000 FCFA
// 50 000 – 99 999       → 1 500 FCFA
// 100 000 – 199 999     → 2 000 FCFA
// 200 000 – 499 999     → 2 500 FCFA
// 500 000 – 999 999     → 3 000 FCFA
// ≥ 1 000 000           → 4 000 FCFA
export function getPayoutFee(amountFcfa: number): number {
  if (amountFcfa < 10_000)   return 550;
  if (amountFcfa < 20_000)   return 750;
  if (amountFcfa < 50_000)   return 1_000;
  if (amountFcfa < 100_000)  return 1_500;
  if (amountFcfa < 200_000)  return 2_000;
  if (amountFcfa < 500_000)  return 2_500;
  if (amountFcfa < 1_000_000) return 3_000;
  return 4_000;
}

export const PAYOUT_FEE_BASE = 550; // frais minimum (pour affichage et validation)
export const PAYOUT_MIN = 3100;     // montant minimum de retrait côté TRIXHUB

// ── Indicatifs téléphoniques par code pays ──────────────────────────────────
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  BJ: "229", BF: "226", CM: "237", CI: "225", CG: "242", CD: "243",
  GA: "241", GH: "233", GN: "224", KE: "254", ML: "223", NE: "227",
  NG: "234", RW: "250", SN: "221", TG: "228", TZ: "255", UG: "256",
};

/**
 * Normalise un numéro mobile pour AccountPE.
 * On renvoie le numéro tel que l'utilisateur l'a saisi (uniquement les chiffres).
 * L'utilisateur doit saisir le numéro dans le format affiché dans l'interface
 * (avec ou sans indicatif, selon ce que l'UI indique) — aucun ajout automatique
 * d'indicatif pays n'est effectué ici.
 */
export function normalizeMobileForPayout(
  mobile: string,
  _mobileFormat: string | null | undefined,
  _countryCode: string,
): string {
  return mobile.replace(/\D/g, "");
}

export async function createPayout(params: {
  countryCode: string;
  name: string;
  email: string;
  mobile: string;
  amountToSend: number; // montant FINAL à envoyer (après déduction des frais si applicable)
  currency: string;
  transactionId: string;
  payoutMethod: string; // id au format "mtn_cm" ou court "MTN" (sera converti automatiquement)
  description: string;
}): Promise<{ id: string; status: "pending" | "success" | "failed" }> {
  let token = await getPayoutToken();

  // AccountPE attend le nom court tel quel : "MTN", "Orange", "Wave", etc.
  // Ne pas convertir en "mtn_cm" — l'API rejette ce format.
  const payoutMethodId = params.payoutMethod;

  const body = {
    country_code:      params.countryCode,
    beneficiary_name:  params.name,
    beneficiary_email: params.email,
    mobile_no:         params.mobile.replace(/\D/g, ""),
    amount:            Math.max(1, Math.round(params.amountToSend)),
    currency:          params.currency,
    transaction_id:    params.transactionId,
    payment_method:    payoutMethodId,
    description:       params.description,
  };

  console.log("[AccountPE] createPayout →", JSON.stringify({ ...body, beneficiary_email: "***" }));

  async function call(tok: string): Promise<Response> {
    return fetchWithTimeout(`${PAYOUT_BASE}/create_transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    }, PAYOUT_TIMEOUT_MS);
  }

  let res = await call(token);
  if (res.status === 401) {
    invalidatePayoutToken();
    token = await getPayoutToken();
    res = await call(token);
  }

  const rawText = await res.text();
  console.log("[AccountPE] createPayout status:", res.status, "body:", rawText.slice(0, 400));

  // AccountPE retourne TOUJOURS HTTP 200 — c'est le champ JSON "status" qui indique succès/erreur
  // Erreur réseau ou auth uniquement
  if (res.status === 401 || res.status >= 500) {
    throw new Error(`AccountPE createPayout échoué: status HTTP ${res.status} — ${rawText.slice(0, 200)}`);
  }

  const data = JSON.parse(rawText) as Record<string, unknown>;
  const jsonStatus = (data.status as number | undefined) ?? 200;
  const message = (data.message as string | undefined) ?? "";

  // Status JSON 400+ = erreur métier (solde insuffisant, champ invalide, etc.)
  if (jsonStatus >= 400) {
    throw new Error(`AccountPE: ${message} (status=${jsonStatus})`);
  }

  const inner = (data.data as Record<string, unknown>) ?? data;
  const id = (inner.id || inner.transaction_id || params.transactionId) as string;
  const rawPayoutStatus = (inner.status ?? inner.payout_status ?? 0) as number | string;

  const statusMap: Record<number, "pending" | "success" | "failed"> = {
    0: "pending",
    1: "success",
    2: "failed",
  };

  let status: "pending" | "success" | "failed";
  if (typeof rawPayoutStatus === "number") {
    status = statusMap[rawPayoutStatus] ?? "pending";
  } else {
    const s = String(rawPayoutStatus).toLowerCase();
    if (s === "success" || s === "paid" || s === "completed") status = "success";
    else if (s === "failed" || s === "rejected") status = "failed";
    else status = "pending";
  }

  return { id, status };
}

// ── Payout : vérifier le statut d'un payout ───────────────────────
export async function checkPayoutStatus(transactionId: string): Promise<{
  status: "pending" | "success" | "failed";
  raw: number | string;
}> {
  let token = await getPayoutToken();

  async function call(tok: string): Promise<Response> {
    return fetchWithTimeout(`${PAYOUT_BASE}/payout_status`, {
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

/**
 * Devise ISO pour chaque pays supporté.
 * Le montant FCFA sera converti dans cette devise avant d'être envoyé
 * au bon portefeuille de notre partenaire de paiement.
 */
export const COUNTRY_CURRENCIES: Record<string, string> = {
  "Bénin":            "XOF",
  "Burkina Faso":     "XOF",
  "Cameroun":         "XAF",
  "Côte d'Ivoire":    "XOF",
  "Congo-Brazzaville":"XAF",
  "RD Congo":         "CDF",
  "Gabon":            "XAF",
  "Ghana":            "GHS",
  "Guinée":           "GNF",
  "Kenya":            "KES",
  "Mali":             "XOF",
  "Niger":            "XOF",
  "Nigeria":          "NGN",
  "Rwanda":           "RWF",
  "Sénégal":          "XOF",
  "Togo":             "XOF",
  "Tanzanie":         "TZS",
  "Ouganda":          "UGX",
};

export { ACCOUNTPE };
