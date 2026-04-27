const SWYCHR_CONFIG = {
  username: process.env.SWYCHR_USERNAME || "",
  password: process.env.SWYCHR_PASSWORD || "",
  webhookSecret: process.env.SWYCHR_WEBHOOK_SECRET || "",
  apiUrl: (
    process.env.ACCOUNTPE_API_URL ||
    process.env.SWYCHR_API_URL ||
    "https://api.accountpe.com"
  ).replace(/\/$/, ""),
};

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getSwychrToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  if (!SWYCHR_CONFIG.username) {
    throw new Error("AccountPE non configuré: SWYCHR_USERNAME manquant");
  }

  const loginUrl = `${SWYCHR_CONFIG.apiUrl}/auth/login`;
  console.log("[AccountPE] Login →", loginUrl);

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: SWYCHR_CONFIG.username,
      password: SWYCHR_CONFIG.password,
    }),
  });

  const rawText = await response.text();
  console.log("[AccountPE] Login status:", response.status, "body:", rawText.slice(0, 300));

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `AccountPE réponse non-JSON (status ${response.status}): ${rawText.slice(0, 200)}`
    );
  }

  const token = (data.token || data.access_token) as string | undefined;
  if (!token) {
    throw new Error(
      `AccountPE login échoué (status ${response.status}): ${JSON.stringify(data)}`
    );
  }

  const expiresIn = ((data.expires_in as number) || 3600) * 1000;
  tokenCache = { token, expiresAt: now + expiresIn };
  console.log("[AccountPE] Token obtenu ✅");
  return token;
}

export async function callAccountPeAPI(
  endpoint: string,
  method: "GET" | "POST" | "PUT" = "POST",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = await getSwychrToken();
  const url = `${SWYCHR_CONFIG.apiUrl}${endpoint}`;
  console.log("[AccountPE] Call →", method, url);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();
  console.log("[AccountPE] Response status:", response.status, "body:", rawText.slice(0, 300));

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(
      `AccountPE réponse non-JSON (${method} ${endpoint}, status ${response.status}): ${rawText.slice(0, 200)}`
    );
  }
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!SWYCHR_CONFIG.webhookSecret || !signature) return true;
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto
    .createHmac("sha256", SWYCHR_CONFIG.webhookSecret)
    .update(rawBody)
    .digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

export function getWebhookUrl(): string {
  const domains = process.env.REPLIT_DOMAINS || "";
  const prodDomain = domains.split(",").find(d => d.includes("trixhub.site") || !d.includes("replit")) || domains.split(",")[0] || "";
  const domain = prodDomain || process.env.REPLIT_DEV_DOMAIN || "";
  return domain ? `https://${domain}/api/accountpe/webhook` : "";
}

export { SWYCHR_CONFIG };
