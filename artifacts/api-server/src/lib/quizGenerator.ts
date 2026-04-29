import { getOpenAIClient } from "./openaiClient";
import type { Logger } from "pino";
import { z } from "zod";

/**
 * Génère 5 questions QCM en français via OpenAI.
 * Thèmes : culture générale, business, Afrique, technologie, économie.
 *
 * Format strict : { questions: [{ q, options: [4 strings], correctIndex: 0..3 }] }
 */

export const QUIZ_QUESTION_COUNT = 5;
export const QUIZ_POINTS_PER_CORRECT = 10; // max 50 si 5/5

const QuestionSchema = z.object({
  q: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

const QuizPayloadSchema = z.object({
  questions: z.array(QuestionSchema).length(QUIZ_QUESTION_COUNT),
});

export type QuizQuestion = z.infer<typeof QuestionSchema>;
export type QuizPayload = z.infer<typeof QuizPayloadSchema>;

const SYSTEM_PROMPT = `Tu es un générateur de quiz pour TRIXHUB, plateforme d'affiliation africaine.
Génère EXACTEMENT 5 questions à choix multiple (QCM) en français.

Thèmes possibles : culture générale, business, Afrique (histoire, géographie, sport, économie),
technologie, e-commerce, marketing digital, finance personnelle, entrepreneuriat.

Règles strictes :
- Niveau accessible (grand public, pas trop expert)
- Chaque question a EXACTEMENT 4 options
- Une seule bonne réponse par question
- Les questions doivent être différentes les unes des autres et variées
- Pas de question piège ni double sens
- Style clair, court, sans ambiguïté

Retourne UNIQUEMENT du JSON valide au format :
{
  "questions": [
    {
      "q": "Quelle est la capitale du Cameroun ?",
      "options": ["Douala", "Yaoundé", "Bafoussam", "Garoua"],
      "correctIndex": 1
    },
    ...4 autres questions...
  ]
}`;

export async function generateQuizQuestions(log: Logger): Promise<QuizPayload> {
  const client = getOpenAIClient();
  const model = "gpt-4o-mini";
  log.info({ model }, "QUIZ_GENERATION_START");

  // Timeout 25s pour rester sous le timeout du tester (30s) et de la route
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let response;
  try {
    response = await client.chat.completions.create(
      {
        model,
        temperature: 0.9,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Génère un nouveau quiz de 5 questions, varié et original. Renvoie UNIQUEMENT le JSON.",
          },
        ],
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI a renvoyé une réponse vide");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    log.error({ err, content: content.slice(0, 500) }, "QUIZ_JSON_PARSE_FAILED");
    throw new Error("Format de réponse IA invalide");
  }

  const result = QuizPayloadSchema.safeParse(parsed);
  if (!result.success) {
    log.error({ error: result.error, parsed }, "QUIZ_SCHEMA_VALIDATION_FAILED");
    throw new Error("Structure de quiz invalide");
  }

  log.info({ count: result.data.questions.length }, "QUIZ_GENERATION_OK");
  return result.data;
}

/**
 * Format envoyé au client (sans correctIndex pour empêcher la triche).
 */
export function questionsForClient(questions: QuizQuestion[]) {
  return questions.map((q, idx) => ({
    index: idx,
    question: q.q,
    options: q.options,
  }));
}
