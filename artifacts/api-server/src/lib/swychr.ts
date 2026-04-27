const PAYIN_BASE = "https://api.accountpe.com/api/payin";
const TOKEN_TTL_MS = 25 * 60 * 1000; // 25 minutes

const ACCOUNTPE = {
  email: process.env.SWYCHR_USERNAME || "",
  password: process.env.SWYCHR_PASSWORD || "",
  webhookSecret: process.env.SWYCHR_WEBHOOK_SECRET || "",
};

let tokenCache: {
  token: string | null;
  expiresAt: number | null;
  inFlight: Promise<string> | null;
} = { token: null, expiresAt: null, inFlight: null };

export async function getAccountPeToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (2 min safety buffer)
  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now + 120_000) {
    return tokenCache.token;
  }

  // Reuse in-flight request if already fetching
  if (tokenCache.inFlight) {
    return tokenCache.inFlight;
  }

  tokenCache.inFlight = (async () => {
    try {
      console.log("[AccountPE] Auth →", `${PAYIN_BASE}/admin/auth`);
      const res = await fetch(`${PAYIN_BASE}/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ACCOUNTPE.email, password: ACCOUNTPE.password }),
      });

      const rawText = await res.text();
      console.log("[AccountPE] Auth status:", res.status, "body:", rawText.slice(0, 200));

      if (!res.ok) throw new Error(`AccountPE auth échoué: status ${res.status} — ${rawText.slice(0, 150)}`);

      const data = JSON.parse(rawText) as Record<string, unknown>;
      const token = data.token as string | undefined;
      if (!token) throw new Error(`AccountPE: pas de token dans la réponse — ${rawText.slice(0, 150)}`);

      tokenCache.token = token;
      tokenCache.expiresAt = now + TOKEN_TTL_MS;
      console.log("[AccountPE] Token obtenu ✅");
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

  // On 401 → refresh token and retry once
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

  // Extract status from nested structure: data.data.attributes.status OR top-level status
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

export { ACCOUNTPE };
