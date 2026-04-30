import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  weeklyPointsTable,
  activityCompletionsTable,
  quizSessionsTable,
  balancesTable,
  usersTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { extractWhatsAppStatusViewCount } from "../lib/ocr";
import { uploadSurpriseShot } from "../lib/uploadSurpriseShot";
import { sendWhatsAppWithMedia } from "../lib/twilio";
import { getPublicBaseUrl } from "../lib/getPublicBaseUrl";
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

        // Vérif : quiz déjà soumis aujourd'hui (fuseau Douala = UTC+1) → bloqué pour la journée
        const doualaNow = new Date(Date.now() + 60 * 60 * 1000);
        doualaNow.setUTCHours(0, 0, 0, 0);
        const todayStartUTC = new Date(doualaNow.getTime() - 60 * 60 * 1000);

        const [quizSubmittedToday] = await db
          .select({ id: quizSessionsTable.id })
          .from(quizSessionsTable)
          .where(
            and(
              eq(quizSessionsTable.userId, userId),
              sql`${quizSessionsTable.submittedAt} >= ${todayStartUTC.toISOString()}`,
            ),
          )
          .limit(1);

        if (quizSubmittedToday) {
          res.status(429).json({
            error: "Quiz déjà effectué aujourd'hui",
            detail: "Tu as déjà fait ton quiz aujourd'hui. Reviens demain !",
            alreadyDone: true,
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

        // Anti-doublon : on extrait les questions des 5 dernières sessions soumises
        const recentSessions = await db
          .select({ questions: quizSessionsTable.questions })
          .from(quizSessionsTable)
          .where(
            and(
              eq(quizSessionsTable.userId, userId),
              sql`${quizSessionsTable.submittedAt} IS NOT NULL`,
            ),
          )
          .orderBy(desc(quizSessionsTable.startedAt))
          .limit(5);

        const recentQuestions: string[] = [];
        for (const s of recentSessions) {
          const qs = s.questions as QuizQuestion[];
          for (const q of qs) {
            recentQuestions.push(q.q);
          }
        }

        const quiz = await generateQuizQuestions(req.log, recentQuestions);
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
        // -1 = pas répondu (timer écoulé) = faux automatiquement
        if (answers.some((a) => !Number.isInteger(a) || a < -1 || a > 3)) {
          res.status(400).json({ error: "Réponses invalides (-1..3)" });
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
        } else {
          // 0 bonne réponse → on enregistre quand même la complétion pour bloquer un nouveau quiz aujourd'hui
          await db.insert(activityCompletionsTable).values({
            userId,
            activityType: "quiz",
            weekStart: getCurrentWeekStart(),
            dayOfWeek: getDayOfWeek(),
            pointsAwarded: 0,
            status: "approved",
          });
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
// Vidéo — sessions en mémoire (durée min 45s pour réclamer les pts)
// ─────────────────────────────────────────────────────────────────
interface VideoSession { sessionId: string; startedAt: number; videoId: string }
const videoSessions = new Map<number, VideoSession>();
const VIDEO_WATCH_MIN_MS = 45_000; // 45 secondes

// POST /activities/video/start — démarre une session de visionnage
router.post(
  "/activities/video/start",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const videoId = String((req.body as { videoId?: unknown }).videoId ?? "");
        if (!videoId) {
          res.status(400).json({ error: "videoId requis" });
          return;
        }

        // Vérifie que l'activité vidéo n'a pas déjà été faite aujourd'hui
        const weekStart = getCurrentWeekStart();
        const dayOfWeek = getDayOfWeek();
        const [existing] = await db
          .select({ id: activityCompletionsTable.id })
          .from(activityCompletionsTable)
          .where(
            and(
              eq(activityCompletionsTable.userId, userId),
              eq(activityCompletionsTable.activityType, "video"),
              eq(activityCompletionsTable.weekStart, weekStart),
              eq(activityCompletionsTable.dayOfWeek, dayOfWeek),
              eq(activityCompletionsTable.status, "approved"),
            ),
          );

        if (existing) {
          res.status(400).json({ error: "Tu as déjà regardé ta vidéo aujourd'hui." });
          return;
        }

        const sessionId = crypto.randomUUID();
        videoSessions.set(userId, { sessionId, startedAt: Date.now(), videoId });
        res.json({ sessionId });
      } catch (err) {
        req.log.error({ err }, "activities/video/start failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// POST /activities/video/claim — réclame 20 pts après 45s de visionnage
router.post(
  "/activities/video/claim",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const { sessionId } = req.body as { sessionId?: string };

        const session = videoSessions.get(userId);
        if (!session || session.sessionId !== sessionId) {
          res.status(400).json({ error: "Session vidéo invalide ou expirée." });
          return;
        }

        const elapsed = Date.now() - session.startedAt;
        if (elapsed < VIDEO_WATCH_MIN_MS) {
          const remaining = Math.ceil((VIDEO_WATCH_MIN_MS - elapsed) / 1000);
          res.status(400).json({
            error: `Encore ${remaining}s de visionnage requis avant de réclamer.`,
          });
          return;
        }

        // Nettoie la session et attribue les points
        videoSessions.delete(userId);

        const result = await awardActivityPoints({
          userId,
          activityType: "video",
          points: ACTIVITY_POINTS.video,
          payloadProof: { videoId: session.videoId },
          log: req.log,
        });

        if (!result.success) {
          const messages: Record<string, string> = {
            daily_cap_reached: "Tu as atteint le maximum de points pour aujourd'hui.",
            weekly_cap_reached: "Tu as atteint le maximum de points pour cette semaine.",
            already_completed: "Tu as déjà regardé ta vidéo aujourd'hui.",
            week_not_accumulating: "Impossible d'ajouter des points cette semaine.",
            invalid_points: "Points invalides.",
          };
          res.status(400).json({
            error: messages[result.reason ?? ""] ?? "Impossible d'attribuer les points.",
          });
          return;
        }

        res.json({
          success: true,
          points: ACTIVITY_POINTS.video,
          totalToday: result.newDailyTotal,
          totalWeek: result.newWeeklyTotal,
        });
      } catch (err) {
        req.log.error({ err }, "activities/video/claim failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// Activité Découverte — sessions en mémoire (même pattern que vidéo)
// ─────────────────────────────────────────────────────────────────
type DiscoverSession = { sessionId: string; startedAt: number; offerId: string };
const discoverSessions = new Map<number, DiscoverSession>();
const DISCOVER_MIN_MS = 60_000; // 60 secondes

// POST /activities/discovery/start
router.post(
  "/activities/discovery/start",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const { offerId } = req.body as { offerId?: string };

        if (!offerId || typeof offerId !== "string") {
          res.status(400).json({ error: "offerId requis." });
          return;
        }

        // Vérifie si déjà complété aujourd'hui
        const weekStart = getCurrentWeekStart();
        const dayOfWeek = getDayOfWeek();
        const existing = await db
          .select({ id: activityCompletionsTable.id })
          .from(activityCompletionsTable)
          .where(
            and(
              eq(activityCompletionsTable.userId, userId),
              eq(activityCompletionsTable.activityType, "discovery"),
              eq(activityCompletionsTable.weekStart, weekStart),
              eq(activityCompletionsTable.dayOfWeek, dayOfWeek),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          res.status(400).json({ error: "Tu as déjà fait ta découverte aujourd'hui." });
          return;
        }

        const sessionId = crypto.randomUUID();
        discoverSessions.set(userId, { sessionId, startedAt: Date.now(), offerId });
        res.json({ sessionId });
      } catch (err) {
        req.log.error({ err }, "activities/discovery/start failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// POST /activities/discovery/claim — réclame 30 pts après 60s
router.post(
  "/activities/discovery/claim",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const { sessionId } = req.body as { sessionId?: string };

        const session = discoverSessions.get(userId);
        if (!session || session.sessionId !== sessionId) {
          res.status(400).json({ error: "Session découverte invalide ou expirée." });
          return;
        }

        const elapsed = Date.now() - session.startedAt;
        if (elapsed < DISCOVER_MIN_MS) {
          const remaining = Math.ceil((DISCOVER_MIN_MS - elapsed) / 1000);
          res.status(400).json({
            error: `Encore ${remaining}s avant de pouvoir réclamer.`,
          });
          return;
        }

        discoverSessions.delete(userId);

        const result = await awardActivityPoints({
          userId,
          activityType: "discovery",
          points: ACTIVITY_POINTS.discovery,
          payloadProof: { offerId: session.offerId },
          log: req.log,
        });

        if (!result.success) {
          const messages: Record<string, string> = {
            daily_cap_reached: "Tu as atteint le maximum de points pour aujourd'hui.",
            weekly_cap_reached: "Tu as atteint le maximum de points pour cette semaine.",
            already_completed: "Tu as déjà fait ta découverte aujourd'hui.",
            week_not_accumulating: "Impossible d'ajouter des points cette semaine.",
            invalid_points: "Points invalides.",
          };
          res.status(400).json({
            error: messages[result.reason ?? ""] ?? "Impossible d'attribuer les points.",
          });
          return;
        }

        res.json({
          success: true,
          points: ACTIVITY_POINTS.discovery,
          totalToday: result.newDailyTotal,
          totalWeek: result.newWeeklyTotal,
        });
      } catch (err) {
        req.log.error({ err }, "activities/discovery/claim failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// Activité Surprise — vendredi uniquement, capture statut WhatsApp
// ─────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_IMAGE_B64_LEN = Math.ceil(10 * 1024 * 1024 * 1.37); // ~10MB encodés en base64

// POST /activities/surprise/submit
router.post(
  "/activities/surprise/submit",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;

        // Vérifie que c'est vendredi (dayOfWeek 4 = vendredi)
        const today = getDayOfWeek();
        if (today !== 4) {
          res.status(400).json({ error: "L'activité Surprise n'est disponible que le vendredi." });
          return;
        }

        const weekStart = getCurrentWeekStart();

        // Vérifie pas déjà fait cette semaine
        const existing = await db
          .select({ id: activityCompletionsTable.id })
          .from(activityCompletionsTable)
          .where(
            and(
              eq(activityCompletionsTable.userId, userId),
              eq(activityCompletionsTable.activityType, "surprise"),
              eq(activityCompletionsTable.weekStart, weekStart),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          res.status(400).json({ error: "Tu as déjà soumis ta capture d'écran cette semaine." });
          return;
        }

        // Valide l'image
        const { imageBase64, mimeType } = req.body as {
          imageBase64?: string;
          mimeType?: string;
        };
        if (!imageBase64 || !mimeType) {
          res.status(400).json({ error: "imageBase64 et mimeType sont requis." });
          return;
        }
        if (!ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase())) {
          res.status(400).json({ error: "Format d'image invalide (jpg, png, webp seulement)." });
          return;
        }
        if (imageBase64.length > MAX_IMAGE_B64_LEN) {
          res.status(400).json({ error: "Image trop grande (max 10 MB)." });
          return;
        }

        const buffer = Buffer.from(imageBase64, "base64");

        // Upload vers Object Storage
        const { objectPath, token, signedUrl } = await uploadSurpriseShot({
          buffer,
          contentType: mimeType,
          userId,
        });

        // OCR — extrait le nombre de vues (silencieux en cas d'échec)
        let viewCount = 0;
        try {
          viewCount = await extractWhatsAppStatusViewCount(imageBase64, mimeType);
        } catch (ocrErr) {
          req.log.warn({ err: ocrErr }, "OCR surprise failed, defaulting to 0 views");
        }

        // Calcule les points : <10 → 0, 10-99 → nb vues, ≥100 → 100
        const rawPoints = viewCount >= 100 ? 100 : viewCount >= 10 ? viewCount : 0;

        // Infos utilisateur pour la notification admin
        const [user] = await db
          .select({ displayName: usersTable.displayName, phone: usersTable.phone, country: usersTable.country })
          .from(usersTable)
          .where(eq(usersTable.id, userId));

        let newDailyTotal = 0;
        let newWeeklyTotal = 0;

        if (rawPoints > 0) {
          const result = await awardActivityPoints({
            userId,
            activityType: "surprise",
            points: rawPoints,
            payloadProof: { objectPath, token, viewCount, signedUrl },
            log: req.log,
          });

          if (!result.success) {
            const messages: Record<string, string> = {
              daily_cap_reached: "Tu as atteint le maximum de points pour aujourd'hui.",
              weekly_cap_reached: "Tu as atteint le maximum de points pour cette semaine.",
              already_completed: "Tu as déjà soumis cette semaine.",
              invalid_points: "Points invalides.",
            };
            res.status(400).json({
              error: messages[result.reason ?? ""] ?? "Impossible d'attribuer les points.",
            });
            return;
          }
          newDailyTotal = result.newDailyTotal;
          newWeeklyTotal = result.newWeeklyTotal;
        } else {
          // < 10 vues : marque comme terminé (0 pts) pour éviter le spam
          await db.insert(activityCompletionsTable).values({
            userId,
            activityType: "surprise",
            weekStart,
            dayOfWeek: 4,
            pointsAwarded: 0,
            payloadProof: { objectPath, token, viewCount, signedUrl },
            status: "approved",
          });
        }

        // Notification admin via Twilio (fire & forget, non bloquant)
        const doubalaTime = new Date(Date.now() + 60 * 60 * 1000);
        const dateStr = doubalaTime.toISOString().slice(0, 16).replace("T", " ") + " Douala";

        // URL permanente vers notre API (accessible indéfiniment via token)
        const permanentUrl = `${getPublicBaseUrl(req)}/api/storage/surprises/${token}`;

        const adminMsg =
          `🎯 *ACTIVITÉ SURPRISE — TRIXHUB*\n\n` +
          `👤 ${user?.displayName ?? "Inconnu"}\n` +
          `📞 ${user?.phone ?? "N/A"}\n` +
          `🌍 ${user?.country ?? "N/A"}\n` +
          `🆔 User #${userId}\n\n` +
          `👁 Vues détectées : *${viewCount}*\n` +
          `🏆 Points attribués : *${rawPoints}*\n\n` +
          `🔗 Lien permanent : ${permanentUrl}\n\n` +
          `⏰ ${dateStr}`;

        void sendWhatsAppWithMedia(adminMsg, signedUrl).catch((err) => {
          req.log.warn({ err }, "Twilio admin surprise notification failed");
        });

        res.json({
          success: true,
          points: rawPoints,
          viewCount,
          totalToday: newDailyTotal,
          totalWeek: newWeeklyTotal,
        });
      } catch (err) {
        req.log.error({ err }, "activities/surprise/submit failed");
        res.status(500).json({ error: "Erreur lors du traitement de la capture d'écran." });
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
