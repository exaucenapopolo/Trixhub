import twilio from "twilio";
import { logger } from "./logger";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM; // ex: "whatsapp:+14155238886"
const TO = process.env.TWILIO_WHATSAPP_TO;     // ex: "whatsapp:+237652205768"

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (client) return client;
  if (!ACCOUNT_SID || !AUTH_TOKEN) return null;
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  return client;
}

function ensurePrefix(num: string | undefined): string | null {
  if (!num) return null;
  const trimmed = num.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  // Si l'utilisateur a mis juste le numéro avec indicatif sans +
  return `whatsapp:+${trimmed.replace(/^\+?/, "")}`;
}

export type SendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

/**
 * Envoie un message WhatsApp au numéro d'assistance via Twilio.
 * Retourne { ok: false } si la config Twilio est absente — ne crash pas.
 */
export async function sendWhatsAppWithMedia(
  message: string,
  mediaUrl: string,
): Promise<SendResult> {
  const cli = getClient();
  const from = ensurePrefix(FROM);
  const to = ensurePrefix(TO);

  if (!cli || !from || !to) {
    logger.warn(
      { hasSid: !!ACCOUNT_SID, hasToken: !!AUTH_TOKEN, hasFrom: !!from, hasTo: !!to },
      "Twilio non configuré : message avec image non envoyé",
    );
    return { ok: false, error: "Service de messagerie non configuré" };
  }

  try {
    const result = await cli.messages.create({ from, to, body: message, mediaUrl: [mediaUrl] });
    logger.info({ sid: result.sid, to }, "Message WhatsApp avec image envoyé via Twilio");
    return { ok: true, sid: result.sid };
  } catch (err: any) {
    logger.error({ err: err?.message ?? String(err), code: err?.code }, "Échec envoi Twilio media");
    return { ok: false, error: err?.message ?? "Erreur d'envoi" };
  }
}

export async function sendWhatsAppToAssistance(message: string): Promise<SendResult> {
  const cli = getClient();
  const from = ensurePrefix(FROM);
  const to = ensurePrefix(TO);

  if (!cli || !from || !to) {
    logger.warn(
      { hasSid: !!ACCOUNT_SID, hasToken: !!AUTH_TOKEN, hasFrom: !!from, hasTo: !!to },
      "Twilio non configuré : message non envoyé",
    );
    return { ok: false, error: "Service de messagerie non configuré" };
  }

  try {
    const result = await cli.messages.create({ from, to, body: message });
    logger.info({ sid: result.sid, to }, "Message WhatsApp envoyé via Twilio");
    return { ok: true, sid: result.sid };
  } catch (err: any) {
    logger.error({ err: err?.message ?? String(err), code: err?.code }, "Échec envoi Twilio");
    return { ok: false, error: err?.message ?? "Erreur d'envoi du message" };
  }
}
