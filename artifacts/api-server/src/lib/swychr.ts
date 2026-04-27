const SWYCHR_CONFIG = {
  username: process.env.SWYCHR_USERNAME || "",
  password: process.env.SWYCHR_PASSWORD || "",
  webhookSecret: process.env.SWYCHR_WEBHOOK_SECRET || "",
  apiUrl: (process.env.SWYCHR_API_URL || "").replace(/\/$/, ""),
};

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getSwychrToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  if (!SWYCHR_CONFIG.apiUrl || !SWYCHR_CONFIG.username) {
    throw new Error("Swychr non configuré: SWYCHR_API_URL ou SWYCHR_USERNAME manquant");
  }

  const loginUrl = `${SWYCHR_CONFIG.apiUrl}/auth/login`;
  console.log("[Swychr] Login attempt →", loginUrl);

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: SWYCHR_CONFIG.username,
      password: SWYCHR_CONFIG.password,
    }),
  });

  const rawText = await response.text();
  console.log("[Swychr] Login response status:", response.status, "body:", rawText.slice(0, 300));

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Swychr login réponse non-JSON (status ${response.status}): ${rawText.slice(0, 200)}`);
  }

  const token = (data.token || data.access_token) as string | undefined;

  if (!token) {
    throw new Error(`Swychr login échoué (status ${response.status}): ${JSON.stringify(data)}`);
  }

  const expiresIn = ((data.expires_in as number) || 3600) * 1000;
  tokenCache = { token, expiresAt: now + expiresIn };
  console.log("[Swychr] Token obtenu avec succès");
  return token;
}

export async function callSwychrAPI(
  endpoint: string,
  method: "GET" | "POST" | "PUT" = "POST",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = await getSwychrToken();
  const response = await fetch(`${SWYCHR_CONFIG.apiUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return await response.json() as Record<string, unknown>;
}

export function verifySwychrWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!SWYCHR_CONFIG.webhookSecret || !signature) return true;
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto
    .createHmac("sha256", SWYCHR_CONFIG.webhookSecret)
    .update(rawBody)
    .digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

export function getWebhookUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
  return domain ? `https://${domain}/api/webhook/swychr` : "";
}

export { SWYCHR_CONFIG };
