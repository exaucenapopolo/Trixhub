import { getOpenAIClient } from "./openaiClient";
import { logger } from "./logger";

/**
 * Analyse une capture d'écran de statut WhatsApp et extrait le nombre de vues.
 * Retourne 0 si l'image ne contient pas de compteur lisible.
 */
export async function extractWhatsAppStatusViewCount(
  imageBase64: string,
  mimeType: string,
): Promise<number> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: `You are analyzing a screenshot of a WhatsApp Status post.
Find the number of views (how many people have viewed this status).
The view count is usually displayed at the bottom of the screen, often next to an eye icon (👁) or the words "vu", "vues", "views", or a standalone number.
Return ONLY the integer view count. No other text, no explanation.
If you cannot find any view count in the image, return exactly: 0`,
          },
        ],
      },
    ],
    max_tokens: 20,
    temperature: 0,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "0";
  const count = parseInt(raw.replace(/[^\d]/g, ""), 10);
  const result = isNaN(count) ? 0 : Math.max(0, count);
  logger.info({ raw, parsed: result }, "OCR WhatsApp view count extracted");
  return result;
}
