import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, balancesTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";

const router: IRouter = Router();

// Récompenses (en FCFA)
const QUIZZ_REWARD_PER_CORRECT = 100;   // Max 5 × 100 = 500 FCFA / jour
const QUIZZ_COOLDOWN_MS = 22 * 60 * 60 * 1000; // 22h pour permettre 1 fois/jour

const VIDEO_REWARD = 75;
const VIDEO_COOLDOWN_MS = 4 * 60 * 60 * 1000;  // 1 vidéo / 4h

// ─────────────────────────────────────────────────────────────────
// Banque de questions côté serveur. Le client ne reçoit JAMAIS
// la propriété `correct`.
// ─────────────────────────────────────────────────────────────────
type Question = { id: number; q: string; choices: string[]; correct: number };

const QUESTION_BANK: Question[] = [
  { id: 1,  q: "Quelle est la capitale du Sénégal ?", choices: ["Dakar", "Abidjan", "Bamako", "Conakry"], correct: 0 },
  { id: 2,  q: "Combien de pays compte la zone CFA (XOF + XAF) ?", choices: ["10", "12", "14", "16"], correct: 2 },
  { id: 3,  q: "Quel pays africain a la plus grande population ?", choices: ["Égypte", "Nigeria", "Éthiopie", "RD Congo"], correct: 1 },
  { id: 4,  q: "Quelle est la monnaie de la RD Congo ?", choices: ["Franc CFA", "Franc Congolais", "Naira", "Cedi"], correct: 1 },
  { id: 5,  q: "Le Mont Kilimandjaro se trouve dans quel pays ?", choices: ["Kenya", "Tanzanie", "Ouganda", "Rwanda"], correct: 1 },
  { id: 6,  q: "Quelle est la capitale économique de la Côte d'Ivoire ?", choices: ["Yamoussoukro", "Abidjan", "Bouaké", "Korhogo"], correct: 1 },
  { id: 7,  q: "Quel fleuve traverse Le Caire ?", choices: ["Congo", "Niger", "Nil", "Sénégal"], correct: 2 },
  { id: 8,  q: "Quel pays produit le plus de cacao au monde ?", choices: ["Ghana", "Côte d'Ivoire", "Nigeria", "Cameroun"], correct: 1 },
  { id: 9,  q: "Mobile Money est arrivé en premier dans quel pays africain ?", choices: ["Nigeria", "Afrique du Sud", "Kenya", "Ghana"], correct: 2 },
  { id: 10, q: "Combien y a-t-il de langues officielles en Afrique du Sud ?", choices: ["3", "5", "11", "15"], correct: 2 },
  { id: 11, q: "Quelle ville est surnommée 'Petit Paris' en Afrique ?", choices: ["Dakar", "Brazzaville", "Abidjan", "Kinshasa"], correct: 1 },
  { id: 12, q: "Le marketing d'affiliation, c'est quoi ?", choices: ["Vendre ses propres produits", "Recommander pour gagner une commission", "Acheter des actions", "Faire du dropshipping"], correct: 1 },
  { id: 13, q: "Qu'est-ce qu'un 'lead' en marketing ?", choices: ["Un client perdu", "Un prospect intéressé", "Un produit", "Une publicité"], correct: 1 },
  { id: 14, q: "WhatsApp Business sert à...", choices: ["Jouer", "Communiquer avec ses clients", "Regarder des films", "Payer en ligne"], correct: 1 },
  { id: 15, q: "Quelle est la capitale du Cameroun ?", choices: ["Douala", "Yaoundé", "Garoua", "Bafoussam"], correct: 1 },
];

const QUESTION_BY_ID = new Map(QUESTION_BANK.map(q => [q.id, q]));

function pickFiveQuestions(): Question[] {
  return [...QUESTION_BANK].sort(() => Math.random() - 0.5).slice(0, 5);
}

async function lastMissionAt(userId: number, type: string): Promise<Date | null> {
  const [t] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, type)))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);
  return t?.createdAt ?? null;
}

// Hash 32 bits stable pour les types de mission, pour pg_advisory_xact_lock.
function lockKey(type: string): number {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) | 0;
  return h;
}

/**
 * Claim atomique d'une mission :
 * - Verrouille (userId, type) avec pg_advisory_xact_lock pour sérialiser les requêtes concurrentes.
 * - Re-vérifie le cooldown sous le lock.
 * - Crée la transaction et crédite le solde missions, le tout dans la même transaction DB.
 * Renvoie true si la mission a été créditée.
 */
async function claimMission(
  userId: number,
  type: string,
  cooldownMs: number,
  description: string,
  amount: number,
): Promise<boolean> {
  const key = lockKey(type);
  return db.transaction(async (tx) => {
    // Sérialise les claims concurrents pour ce (userId, type)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}, ${key})`);

    // Re-check sous lock
    const [last] = await tx.select().from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, type)))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < cooldownMs) {
      return false;
    }

    await tx.insert(transactionsTable).values({
      userId,
      type,
      amount: amount.toFixed(2),
      description,
      status: "completed",
    });

    if (amount > 0) {
      const updated = await tx.update(balancesTable)
        .set({ taskBalance: sql`(${balancesTable.taskBalance})::numeric + ${amount.toFixed(2)}::numeric` })
        .where(eq(balancesTable.userId, userId))
        .returning();
      if (updated.length === 0) {
        await tx.insert(balancesTable).values({
          userId,
          referralBalance: "0",
          taskBalance: amount.toFixed(2),
          inactiveBalance: "0",
          withdrawnAmount: "0",
          spentAmount: "0",
        });
      }
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// QUIZZ — Le serveur tire les questions ET fait le score.
// ─────────────────────────────────────────────────────────────────

router.get("/missions/quizz/status", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const last = await lastMissionAt(userId, "mission_quizz");
  const available = !last || (Date.now() - last.getTime() >= QUIZZ_COOLDOWN_MS);
  res.json({
    available,
    rewardPerCorrect: QUIZZ_REWARD_PER_CORRECT,
    nextAvailableAt: last && !available ? new Date(last.getTime() + QUIZZ_COOLDOWN_MS).toISOString() : null,
  });
});

// Le client demande 5 questions. Le serveur ne renvoie PAS la bonne réponse.
router.get("/missions/quizz/questions", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const last = await lastMissionAt(userId, "mission_quizz");
  if (last && Date.now() - last.getTime() < QUIZZ_COOLDOWN_MS) {
    res.status(429).json({
      error: "Vous avez déjà fait le quizz aujourd'hui. Revenez demain.",
      nextAvailableAt: new Date(last.getTime() + QUIZZ_COOLDOWN_MS).toISOString(),
    });
    return;
  }
  const questions = pickFiveQuestions().map(q => ({ id: q.id, q: q.q, choices: q.choices }));
  res.json({ questions });
});

router.post("/missions/quizz/submit", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const body = req.body as { answers?: { id?: number; choice?: number }[] };
  const rawAnswers = Array.isArray(body.answers) ? body.answers : [];

  // Anti-fraude : on n'accepte qu'une réponse par question (dédupliqué par id),
  // et on plafonne à 5 questions distinctes de la banque.
  const seen = new Set<number>();
  const uniqueAnswers: { id: number; choice: number }[] = [];
  for (const a of rawAnswers) {
    if (typeof a.id !== "number" || typeof a.choice !== "number") continue;
    if (!QUESTION_BY_ID.has(a.id)) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    uniqueAnswers.push({ id: a.id, choice: a.choice });
    if (uniqueAnswers.length === 5) break;
  }

  let score = 0;
  for (const a of uniqueAnswers) {
    const q = QUESTION_BY_ID.get(a.id)!;
    if (q.correct === a.choice) score++;
  }
  score = Math.min(5, Math.max(0, score));

  const reward = score * QUIZZ_REWARD_PER_CORRECT;
  const description = `Quizz : ${score}/5 bonnes réponses`;

  const claimed = await claimMission(userId, "mission_quizz", QUIZZ_COOLDOWN_MS, description, reward);
  if (!claimed) {
    const last = await lastMissionAt(userId, "mission_quizz");
    res.status(429).json({
      error: "Vous avez déjà fait le quizz aujourd'hui. Revenez demain.",
      nextAvailableAt: last ? new Date(last.getTime() + QUIZZ_COOLDOWN_MS).toISOString() : null,
    });
    return;
  }

  res.json({ score, reward, nextAvailableAt: new Date(Date.now() + QUIZZ_COOLDOWN_MS).toISOString() });
});

// ─────────────────────────────────────────────────────────────────
// VIDÉO — Le client demande une session, le serveur la persiste en DB
// (type='mission_video_session', amount=0), puis le client peut "claim"
// si ≥30s se sont écoulées. Persisté pour survivre aux restarts/multi-instance.
// ─────────────────────────────────────────────────────────────────
const VIDEO_MIN_WATCH_MS = 30 * 1000;
const VIDEO_SESSION_TYPE = "mission_video_session";

router.get("/missions/video/status", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const last = await lastMissionAt(userId, "mission_video");
  const available = !last || (Date.now() - last.getTime() >= VIDEO_COOLDOWN_MS);
  res.json({
    available,
    reward: VIDEO_REWARD,
    nextAvailableAt: last && !available ? new Date(last.getTime() + VIDEO_COOLDOWN_MS).toISOString() : null,
  });
});

// Le client appelle ça quand il commence à regarder. Persisté en DB.
router.post("/missions/video/start", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const last = await lastMissionAt(userId, "mission_video");
  if (last && Date.now() - last.getTime() < VIDEO_COOLDOWN_MS) {
    res.status(429).json({
      error: "Vidéo déjà visionnée récemment. Revenez plus tard.",
      nextAvailableAt: new Date(last.getTime() + VIDEO_COOLDOWN_MS).toISOString(),
    });
    return;
  }
  // Supprime l'ancienne session puis insère une nouvelle (timestamp = createdAt par défaut)
  await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, VIDEO_SESSION_TYPE)));
  await db.insert(transactionsTable).values({
    userId,
    type: VIDEO_SESSION_TYPE,
    amount: "0",
    description: "Session vidéo démarrée",
    status: "pending",
  });
  res.json({ started: true, requiredSeconds: VIDEO_MIN_WATCH_MS / 1000 });
});

router.post("/missions/video/complete", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const [session] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, VIDEO_SESSION_TYPE)))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);

  if (!session) {
    res.status(400).json({ error: "Démarrez d'abord la vidéo avant de réclamer la récompense." });
    return;
  }
  const elapsed = Date.now() - session.createdAt.getTime();
  if (elapsed < VIDEO_MIN_WATCH_MS) {
    res.status(400).json({
      error: `Vous devez regarder au moins ${VIDEO_MIN_WATCH_MS / 1000} secondes (${Math.floor(elapsed / 1000)}s écoulées).`,
    });
    return;
  }

  const claimed = await claimMission(userId, "mission_video", VIDEO_COOLDOWN_MS, "Vidéo regardée jusqu'au bout", VIDEO_REWARD);
  if (!claimed) {
    const last = await lastMissionAt(userId, "mission_video");
    res.status(429).json({
      error: "Vidéo déjà visionnée récemment. Revenez plus tard.",
      nextAvailableAt: last ? new Date(last.getTime() + VIDEO_COOLDOWN_MS).toISOString() : null,
    });
    return;
  }

  // Nettoie la session consommée
  await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, VIDEO_SESSION_TYPE)));

  res.json({ reward: VIDEO_REWARD, nextAvailableAt: new Date(Date.now() + VIDEO_COOLDOWN_MS).toISOString() });
});

export default router;
