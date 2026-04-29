import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

let cached: OpenAI | null = null;

/**
 * Client OpenAI pré-configuré via les Replit AI Integrations.
 * BASE_URL et API_KEY sont auto-provisionnés.
 */
export function getOpenAIClient(): OpenAI {
  if (cached) return cached;
  if (!baseURL || !apiKey) {
    throw new Error(
      "OpenAI integration not configured (AI_INTEGRATIONS_OPENAI_BASE_URL / API_KEY missing)",
    );
  }
  cached = new OpenAI({ baseURL, apiKey });
  return cached;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(baseURL && apiKey);
}
