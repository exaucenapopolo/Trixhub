import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { db, usersTable, transactionsTable, balancesTable, activityCompletionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { activateUserTx, ACTIVATION_AMOUNT, REFERRAL_PAYMENT_FEE } from "../lib/activation";

const router: IRouter = Router();

function formatReferralUser(user: typeof usersTable.$inferSelect, level: number) {
  return {
    id: user.id,
    displayName: user.displayName || user.email.split("@")[0],
    country: user.country,
    isActivated: user.isActivated,
    joinedAt: user.createdAt.toISOString(),
    level,
  };
}

router.get("/referrals/team", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  if (req.user?.blockedReferral) {
    res.status(403).json({ error: "Votre accès au parrainage a été restreint par l'administrateur.", code: "REFERRAL_BLOCKED" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const l1 = await db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));

  const l2: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l1) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l2.push(...members);
  }

  const l3: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l2) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l3.push(...members);
  }

  const allFormatted = [
    ...l1.map(m => formatReferralUser(m, 1)),
    ...l2.map(m => formatReferralUser(m, 2)),
    ...l3.map(m => formatReferralUser(m, 3)),
  ];

  const active = allFormatted.filter(m => m.isActivated).length;
  const inactive = allFormatted.filter(m => !m.isActivated).length;

  res.json({ total: allFormatted.length, active, inactive, members: allFormatted });
});

router.get("/referrals/level/:level", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rawLevel = Array.isArray(req.params.level) ? req.params.level[0] : req.params.level;
  const level = parseInt(rawLevel, 10);

  if (![1, 2, 3].includes(level)) {
    res.status(400).json({ error: "Niveau invalide (1, 2 ou 3)" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const commissions = { 1: 1700, 2: 700, 3: 200 };
  const commission = commissions[level as 1 | 2 | 3];

  let members: (typeof usersTable.$inferSelect)[] = [];

  if (level === 1) {
    members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));
  } else if (level === 2) {
    const l1 = await db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));
    for (const m of l1) {
      const l2m = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
      members.push(...l2m);
    }
  } else if (level === 3) {
    const l1 = await db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));
    for (const m of l1) {
      const l2m = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
      for (const m2 of l2m) {
        const l3m = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m2.referralCode));
        members.push(...l3m);
      }
    }
  }

  const formatted = members.map(m => formatReferralUser(m, level));
  res.json({ level, commission, total: formatted.length, active: formatted.filter(m => m.isActivated).length, inactive: formatted.filter(m => !m.isActivated).length, members: formatted });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/referrals/activate-child/:childId
// Permet à un parent d'activer son filleul N1 inactif en payant pour lui.
// Body: { source: "deposit" | "referral" }
//   - "deposit"  : débite 3600 du solde dépôt du parent
//   - "referral" : débite 4100 (3600 + 500 frais) du solde parrainage du parent
// Le paiement Swychr direct passe par /api/swychr/initiate avec purpose=child_activation.
// ─────────────────────────────────────────────────────────────────
router.post("/referrals/activate-child/:childId", authenticate, requireActivation, async (req, res): Promise<void> => {
  const parentId = req.userId!;
  const childId = parseInt(req.params.childId as string, 10);
  const { source } = req.body as { source?: "deposit" | "referral" };

  if (!Number.isFinite(childId) || childId <= 0) {
    res.status(400).json({ error: "ID filleul invalide" });
    return;
  }
  if (source !== "deposit" && source !== "referral") {
    res.status(400).json({ error: "Source invalide (deposit | referral)" });
    return;
  }

  // 1. Vérifications (lectures hors-tx, OK car la tx ré-vérifie)
  const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, parentId));
  if (!parent) {
    res.status(401).json({ error: "Parent introuvable" });
    return;
  }
  const [child] = await db.select().from(usersTable).where(eq(usersTable.id, childId));
  if (!child) {
    res.status(404).json({ error: "Filleul introuvable" });
    return;
  }
  if (child.referredByCode !== parent.referralCode) {
    res.status(403).json({ error: "Ce membre n'est pas votre filleul direct" });
    return;
  }
  if (child.isActivated) {
    res.status(400).json({ error: "Ce filleul est déjà activé" });
    return;
  }

  const cost = source === "deposit" ? ACTIVATION_AMOUNT : ACTIVATION_AMOUNT + REFERRAL_PAYMENT_FEE;
  const sourceField = source === "deposit" ? balancesTable.depositBalance : balancesTable.referralBalance;
  const sourceLabel = source === "deposit" ? "solde dépôt" : "solde parrainage";
  const txType = source === "deposit" ? "child_activation_deposit" : "child_activation_referral";

  // 2. TRANSACTION ATOMIQUE :
  //    a) UPDATE conditionnel `WHERE balance >= cost` → débit anti-race
  //    b) Insert log de débit côté parent
  //    c) activateUserTx du filleul (set is_activated, bonus, commissions)
  // Si l'une échoue, tout rollback : pas de débit fantôme, pas d'activation orpheline.
  type Outcome =
    | { ok: true }
    | { ok: false; status: number; error: string; required?: number };

  let outcome: Outcome;
  try {
    outcome = await db.transaction(async (tx): Promise<Outcome> => {
      // a) Débit atomique conditionnel
      const debited = await tx
        .update(balancesTable)
        .set({ [source === "deposit" ? "depositBalance" : "referralBalance"]: sql`${sourceField} - ${cost}` })
        .where(and(eq(balancesTable.userId, parentId), gte(sourceField, cost.toString())))
        .returning();

      if (debited.length === 0) {
        return {
          ok: false,
          status: 402,
          error: `Solde insuffisant : il vous faut ${cost.toLocaleString("fr-FR")} FCFA dans votre ${sourceLabel}`,
          required: cost,
        };
      }

      // b) Log débit
      await tx.insert(transactionsTable).values({
        userId: parentId,
        type: txType,
        amount: `-${cost.toFixed(2)}`,
        description: `Activation du filleul ${child.displayName || child.email.split("@")[0]} via ${sourceLabel}${source === "referral" ? ` (frais : ${REFERRAL_PAYMENT_FEE} FCFA inclus)` : ""}`,
        relatedUserId: child.id,
        status: "completed",
      });

      // c) Activation idempotente du filleul (+ commissions). Si déjà activé → throw pour rollback.
      const activated = await activateUserTx(tx, child.id, ACTIVATION_AMOUNT, `parent_${source}`, parentId, req.log);
      if (!activated) {
        throw new Error("CHILD_ALREADY_ACTIVATED");
      }

      return { ok: true };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "CHILD_ALREADY_ACTIVATED") {
      res.status(409).json({ error: "Filleul déjà activé entre-temps. Aucun débit appliqué." });
      return;
    }
    req.log.error({ err, parentId, childId, source }, "[activate-child] transaction error");
    res.status(500).json({ error: "Erreur interne lors de l'activation" });
    return;
  }

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error, required: outcome.required });
    return;
  }

  res.json({
    success: true,
    childId,
    cost,
    source,
    message: `Filleul activé avec succès. ${cost.toLocaleString("fr-FR")} FCFA débité de votre ${sourceLabel}.`,
  });
});

const ACTIVITY_LABELS: Record<string, string> = {
  video: "Vidéo",
  quiz: "Quiz IA",
  discovery: "Découverte",
  surprise: "Surprise",
};

router.get("/referrals/activity", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const [transactions, completions] = await Promise.all([
    db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20),
    db.select().from(activityCompletionsTable)
      .where(eq(activityCompletionsTable.userId, userId))
      .orderBy(desc(activityCompletionsTable.createdAt))
      .limit(20),
  ]);

  const txItems = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    message: t.description,
    amount: t.amount ? parseFloat(t.amount) : null,
    status: t.status ?? "completed",
    createdAt: t.createdAt.toISOString(),
  }));

  const actItems = completions.map((c) => ({
    id: c.id + 1_000_000,
    type: `activity_${c.activityType}` as string,
    message:
      (c.pointsAwarded ?? 0) > 0
        ? `Activité ${ACTIVITY_LABELS[c.activityType] ?? c.activityType} — +${c.pointsAwarded} pts gagnés`
        : `Activité ${ACTIVITY_LABELS[c.activityType] ?? c.activityType} — 0 pt (score insuffisant)`,
    amount: c.pointsAwarded ?? 0,
    status: "completed" as string,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
  }));

  const merged = [...txItems, ...actItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  res.json(merged);
});

export default router;
