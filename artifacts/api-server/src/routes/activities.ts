import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  weeklyPointsTable,
  activityCompletionsTable,
  quizSessionsTable,
  balancesTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import {
  awardActivityPoints,
  convertWeeklyPointsToBalance,
  expirePastUnconvertedWeeks,
  getCurrentWeekStart,
  getDayOfWeek,
  isSunday,
  ACTIVITY_POINTS,
  DAILY_POINT_CAP,
  WEEKLY_POINT_CAP,
} from "../lib/weeklyPoints";
import {
  generateQuizQuestions,
  questionsForClient,
  QUIZ_POINTS_PER_CORRECT,
  type QuizQuestion,
} from "../lib/quizGenerator";
import { isOpenAIConfigured } from "../lib/openaiClient";

const router: IRouter = Router();

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ─────────────────────────────────────────────────────────────────
// GET /activities/weekly-status — état hebdo + cap quotidien + jour
// ─────────────────────────────────────────────────────────────────
router.get(
  "/activities/weekly-status",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;

        // Lazy : marquer les semaines passées non converties comme expired
        await expirePastUnconvertedWeeks(userId);

        const weekStart = getCurrentWeekStart();
        const dayOfWeek = getDayOfWeek();

        const [weekly] = await db
          .select()
          .from(weeklyPointsTable)
          .where(
            and(eq(weeklyPointsTable.userId, userId), eq(weeklyPointsTable.weekStart, weekStart)),
          );

        const breakdown = (weekly?.dailyBreakdown ?? {}) as Record<string, number>;
        const dailyTotal = breakdown[String(dayOfWeek)] ?? 0;
        const weeklyTotal = weekly?.totalPoints ?? 0;
        const status = weekly?.status ?? "accumulating";

        const sunday = isSunday();
        const canConvert = sunday && weeklyTotal === WEEKLY_POINT_CAP && status === "accumulating";

        // Compte combien de fois chaque type d'activité a été fait aujourd'hui
        const todayCompletions = await db
          .select({
            type: activityCompletionsTable.activityType,
            points: activityCompletionsTable.pointsAwarded,
            status: activityCompletionsTable.status,
          })
          .from(activityCompletionsTable)
          .where(
            and(
              eq(activityCompletionsTable.userId, userId),
              eq(activityCompletionsTable.weekStart, weekStart),
              eq(activityCompletionsTable.dayOfWeek, dayOfWeek),
            ),
          );

        const todayByType: Record<string, { count: number; points: number }> = {};
        for (const c of todayCompletions) {
          if (c.status !== "approved") continue;
          if (!todayByType[c.type]) todayByType[c.type] = { count: 0, points: 0 };
          todayByType[c.type].count++;
          todayByType[c.type].points += c.points;
        }

        res.json({
          weekStart,
          dayOfWeek,
          dayLabel: DAY_LABELS[dayOfWeek],
          isSunday: sunday,
          status,
          weeklyTotal,
          weeklyCap: WEEKLY_POINT_CAP,
          weeklyRemaining: Math.max(0, WEEKLY_POINT_CAP - weeklyTotal),
          dailyTotal,
          dailyCap: DAILY_POINT_CAP,
          dailyRemaining: Math.max(0, DAILY_POINT_CAP - dailyTotal),
          dailyBreakdown: breakdown,
          canConvert,
          convertedAt: weekly?.convertedAt ?? null,
          convertedAmount: weekly?.convertedAmount ?? null,
          todayByType,
          activityRewards: ACTIVITY_POINTS,
        });
      } catch (err) {
        req.log.error({ err }, "weekly-status failed");
        res.status(500).json({ error: "Erreur lors de la récupération du statut" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// POST /activities/quiz/start — génère 5 questions IA
// ─────────────────────────────────────────────────────────────────
router.post(
  "/activities/quiz/start",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        if (!isOpenAIConfigured()) {
          res.status(503).json({ error: "Service IA temporairement indisponible" });
          return;
        }

        const userId = req.userId!;
        const weekStart = getCurrentWeekStart();
        const dayOfWeek = getDayOfWeek();

        // Vérif cap quotidien : si user a déjà 100 pts aujourd'hui, on bloque
        const [weekly] = await db
          .select()
          .from(weeklyPointsTable)
          .where(
            and(eq(weeklyPointsTable.userId, userId), eq(weeklyPointsTable.weekStart, weekStart)),
          );
        const breakdown = (weekly?.dailyBreakdown ?? {}) as Record<string, number>;
        const dailyTotal = breakdown[String(dayOfWeek)] ?? 0;

        if (dailyTotal >= DAILY_POINT_CAP) {
          res.status(429).json({
            error: "Plafond quotidien atteint",
            detail: `Tu as déjà gagné ${DAILY_POINT_CAP} points aujourd'hui. Reviens demain !`,
          });
          return;
        }
        if ((weekly?.totalPoints ?? 0) >= WEEKLY_POINT_CAP) {
          res.status(429).json({
            error: "Plafond hebdomadaire atteint",
            detail: `Tu as atteint ${WEEKLY_POINT_CAP} points cette semaine. ${
              isSunday() ? "Convertis-les maintenant !" : "Attends dimanche pour convertir."
            }`,
          });
          return;
        }

        // Vérif : pas de session quiz déjà non submitted ouverte (anti-spam)
        const [existing] = await db
          .select()
          .from(quizSessionsTable)
          .where(eq(quizSessionsTable.userId, userId))
          .orderBy(desc(quizSessionsTable.startedAt))
          .limit(1);

        // Si la dernière session date de moins de 5min et n'est pas submitted, on la réutilise
        if (existing && !existing.submittedAt) {
          const ageMs = Date.now() - new Date(existing.startedAt).getTime();
          if (ageMs < 5 * 60 * 1000) {
            const questions = existing.questions as QuizQuestion[];
            res.json({
              sessionId: existing.id,
              questions: questionsForClient(questions),
              startedAt: existing.startedAt,
              pointsPerCorrect: QUIZ_POINTS_PER_CORRECT,
            });
            return;
          }
        }

        const quiz = await generateQuizQuestions(req.log);
        const [session] = await db
          .insert(quizSessionsTable)
          .values({
            userId,
            questions: quiz.questions,
          })
          .returning();

        res.json({
          sessionId: session.id,
          questions: questionsForClient(quiz.questions),
          startedAt: session.startedAt,
          pointsPerCorrect: QUIZ_POINTS_PER_CORRECT,
        });
      } catch (err) {
        req.log.error({ err }, "quiz/start failed");
        res.status(500).json({ error: "Impossible de générer le quiz pour le moment" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// POST /activities/quiz/:sessionId/submit — valide réponses + award
// ─────────────────────────────────────────────────────────────────
router.post(
  "/activities/quiz/:sessionId/submit",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const sessionId = parseInt(String(req.params.sessionId ?? ""), 10);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
          res.status(400).json({ error: "Session invalide" });
          return;
        }

        const body = req.body as { answers?: unknown };
        if (!Array.isArray(body.answers) || body.answers.length !== 5) {
          res.status(400).json({ error: "5 réponses attendues" });
          return;
        }
        const answers = body.answers.map((a) => Number(a));
        if (answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
          res.status(400).json({ error: "Réponses invalides (0..3)" });
          return;
        }

        // Récupère la session (lecture seule pour le calcul score)
        const [session] = await db
          .select()
          .from(quizSessionsTable)
          .where(
            and(eq(quizSessionsTable.id, sessionId), eq(quizSessionsTable.userId, userId)),
          );

        if (!session) {
          res.status(404).json({ error: "Session introuvable" });
          return;
        }
        if (session.submittedAt) {
          res.status(409).json({ error: "Quiz déjà soumis" });
          return;
        }

        // TTL session : 15 minutes max après start
        const ageMs = Date.now() - new Date(session.startedAt).getTime();
        const SESSION_TTL_MS = 15 * 60 * 1000;
        if (ageMs > SESSION_TTL_MS) {
          // Marque la session comme expirée pour éviter retry infini
          await db
            .update(quizSessionsTable)
            .set({ submittedAt: new Date(), score: 0, pointsAwarded: 0, answers })
            .where(
              and(
                eq(quizSessionsTable.id, sessionId),
                sql`${quizSessionsTable.submittedAt} IS NULL`,
              ),
            );
          res.status(410).json({ error: "Session expirée. Démarre un nouveau quiz." });
          return;
        }

        const questions = session.questions as QuizQuestion[];
        let correct = 0;
        const corrections = questions.map((q, i) => {
          const ok = answers[i] === q.correctIndex;
          if (ok) correct++;
          return { index: i, userAnswer: answers[i], correctIndex: q.correctIndex, ok };
        });

        const pointsToAward = correct * QUIZ_POINTS_PER_CORRECT;

        // ── ATOMIC CLAIM : on tente de claim la session AVANT d'attribuer les points
        //    UPDATE conditionnel sur submitted_at IS NULL → si 0 rows = race perdue
        const claimed = await db
          .update(quizSessionsTable)
          .set({
            submittedAt: new Date(),
            answers,
            score: correct,
            pointsAwarded: 0, // sera mis à jour après award
          })
          .where(
            and(
              eq(quizSessionsTable.id, sessionId),
              eq(quizSessionsTable.userId, userId),
              sql`${quizSessionsTable.submittedAt} IS NULL`,
            ),
          )
          .returning({ id: quizSessionsTable.id });

        if (claimed.length === 0) {
          // Une autre requête a déjà soumis cette session
          res.status(409).json({ error: "Quiz déjà soumis (concurrence)" });
          return;
        }

        let awarded = 0;
        let awardError: string | null = null;
        if (pointsToAward > 0) {
          const result = await awardActivityPoints({
            userId,
            activityType: "quiz",
            points: pointsToAward,
            log: req.log,
          });
          if (result.success) {
            awarded = result.awarded;
            // Update du nombre de points effectivement attribués
            await db
              .update(quizSessionsTable)
              .set({ pointsAwarded: awarded })
              .where(eq(quizSessionsTable.id, sessionId));
          } else {
            awardError =
              result.reason === "daily_cap"
                ? "Plafond quotidien atteint, points non comptabilisés"
                : result.reason === "weekly_cap"
                ? "Plafond hebdomadaire atteint, points non comptabilisés"
                : "Points non comptabilisés";
          }
        }

        res.json({
          score: correct,
          total: questions.length,
          pointsAwarded: awarded,
          corrections,
          awardError,
        });
      } catch (err) {
        req.log.error({ err }, "quiz/submit failed");
        res.status(500).json({ error: "Erreur lors de la soumission" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// POST /activities/convert — conversion dimanche 700pts → 700 FCFA
// ─────────────────────────────────────────────────────────────────
router.post(
  "/activities/convert",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const result = await convertWeeklyPointsToBalance({ userId, log: req.log });

        if (!result.success) {
          const messages: Record<string, string> = {
            not_sunday: "La conversion n'est possible que le dimanche",
            not_full_700: `Tu dois avoir exactement ${WEEKLY_POINT_CAP} points (tu en as ${result.currentTotal})`,
            already_converted: "Tu as déjà converti tes points cette semaine",
            no_week: "Aucun point gagné cette semaine",
          };
          res.status(400).json({
            error: messages[result.reason] ?? "Conversion impossible",
            reason: result.reason,
            currentTotal: result.currentTotal,
          });
          return;
        }

        // Récupère le nouveau solde activité pour le retour
        const [bal] = await db
          .select({ activityBalance: balancesTable.activityBalance })
          .from(balancesTable)
          .where(eq(balancesTable.userId, userId));

        res.json({
          success: true,
          convertedAmount: result.convertedAmount,
          newActivityBalance: bal?.activityBalance ?? "0",
        });
      } catch (err) {
        req.log.error({ err }, "activities/convert failed");
        res.status(500).json({ error: "Erreur lors de la conversion" });
      }
    })();
  },
);

export default router;
