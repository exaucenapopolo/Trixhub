import { OpenAI } from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (openai) {
    return openai;
  }

  openai = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return openai;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(baseURL && apiKey);
}