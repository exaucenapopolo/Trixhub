import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql, and, count, gte, lt } from "drizzle-orm";
import {
  db,
  usersTable,
  balancesTable,
  withdrawalsTable,
  activityWithdrawalsTable,
  transactionsTable,
  contactPurchasesTable,
  weeklyPointsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/requireAdmin";
import { hashPassword } from "../lib/auth";
import { activateUserTx } from "../lib/activation";
import { COUNTRY_CODES, COUNTRY_CURRENCIES, PAYOUT_MIN } from "../lib/swychr";
import { CURRENCY_RATES } from "../lib/currency";

const router: IRouter = Router();

const PROFIT_PER_ACTIVATION = 900;

// ─────────────────────────────────────────────────────────────────
// GET /admin/stats — tableau de bord global
// ─────────────────────────────────────────────────────────────────
// Commission max possible par activation si la chaîne est complète (L1+L2+L3)
const MAX_COMMISSIONS_PER_ACTIVATION = 1700 + 700 + 300; // 2700 FCFA

router.get("/admin/stats", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const [totalRow]        = await db.select({ total: count() }).from(usersTable);
  const [activeRow]       = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isActivated, true));
  const [bannedRow]       = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isBanned, true));
  const [pendingWRow]     = await db.select({ total: count(), sum: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [processingWRow]  = await db.select({ total: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "processing"));
  const [pendingAWRow]    = await db.select({ total: count() }).from(activityWithdrawalsTable).where(eq(activityWithdrawalsTable.status, "pending"));
  const [approvedAWRow]   = await db.select({ total: count() }).from(activityWithdrawalsTable).where(eq(activityWithdrawalsTable.status, "approved"));
  const [totalWithdrawnRow] = await db.select({ sum: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "completed"));
  const [totalActivationsRevRow] = await db.select({ sum: sql<string>`COALESCE(SUM(spent_amount::numeric),0)` }).from(balancesTable);

  // ── Nouvelles métriques réseau ──────────────────────────────────
  // 1. Inscrits sans parrain (referredByCode IS NULL)
  const [noSponsorRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(sql`${usersTable.referredByCode} IS NULL`);

  // 2. Inscrits avec parrain mais 0 filleul eux-mêmes
  //    (leur referralCode n'apparaît chez aucun autre utilisateur)
  const [noReferralsRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(and(
      sql`${usersTable.referredByCode} IS NOT NULL`,
      sql`NOT EXISTS (
        SELECT 1 FROM users u2
        WHERE u2.referred_by_code = ${usersTable.referralCode}
      )`
    ));

  // 3. Commissions réellement versées aux filleuls (L1+L2+L3 actives uniquement)
  const [commissionsPaidRow] = await db
    .select({ sum: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
    .from(transactionsTable)
    .where(sql`${transactionsTable.type} IN ('referral_l1','referral_l2','referral_l3') AND ${transactionsTable.amount}::numeric > 0`);

  // ── Calculs ────────────────────────────────────────────────────
  const total     = totalRow?.total      ?? 0;
  const active    = activeRow?.total     ?? 0;
  const inactive  = total - active;
  const banned    = bannedRow?.total     ?? 0;
  const noSponsor   = noSponsorRow?.total    ?? 0;
  const noReferrals = noReferralsRow?.total  ?? 0;

  // Revenu primaire : 900 FCFA × nombre d'activés
  const companyProfit = active * PROFIT_PER_ACTIVATION;

  // Revenu secondaire : commissions non versées car chaîne incomplète
  // = (activés × 2700) − commissions réellement payées
  const commissionsPaid    = parseFloat(commissionsPaidRow?.sum ?? "0");
  const maxCommissions     = active * MAX_COMMISSIONS_PER_ACTIVATION;
  const secondaryIncome    = Math.max(0, maxCommissions - commissionsPaid);
  const totalCompanyIncome = companyProfit + secondaryIncome;

  res.json({
    users: { total, active, inactive, banned, noSponsor, noReferrals },
    withdrawals: {
      pendingCount: pendingWRow?.total ?? 0,
      pendingAmount: parseFloat(pendingWRow?.sum ?? "0"),
      processingCount: processingWRow?.total ?? 0,
      totalPaid: parseFloat(totalWithdrawnRow?.sum ?? "0"),
    },
    activityWithdrawals: {
      pendingCount: pendingAWRow?.total ?? 0,
      approvedCount: approvedAWRow?.total ?? 0,
    },
    finance: {
      companyProfit,
      secondaryIncome,
      totalCompanyIncome,
      commissionsPaid,
      totalRevenue: parseFloat(totalActivationsRevRow?.sum ?? "0"),
      profitPerActivation: PROFIT_PER_ACTIVATION,
    },
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/growth — comparaisons par période (jour / semaine / mois)
// ─────────────────────────────────────────────────────────────────
router.get("/admin/growth", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const weekStart    = new Date(todayStart.getTime() - 7 * 86_400_000);
    const lastWeekStart= new Date(weekStart.getTime()  - 7 * 86_400_000);
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Inscriptions ─────────────────────────────────────────────
    const [[todayReg], [yestReg], [weekReg], [lastWeekReg], [monthReg], [lastMonthReg]] = await Promise.all([
      db.select({ n: count() }).from(usersTable).where(gte(usersTable.createdAt, todayStart)),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, yesterdayStart), lt(usersTable.createdAt, todayStart))),
      db.select({ n: count() }).from(usersTable).where(gte(usersTable.createdAt, weekStart)),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastWeekStart), lt(usersTable.createdAt, weekStart))),
      db.select({ n: count() }).from(usersTable).where(gte(usersTable.createdAt, monthStart)),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastMonthStart), lt(usersTable.createdAt, monthStart))),
    ]);

    // ── Activations dans la période (inscrits + actifs) ───────────
    const [[todayAct], [yestAct], [weekAct], [lastWeekAct], [monthAct], [lastMonthAct]] = await Promise.all([
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, todayStart), eq(usersTable.isActivated, true))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, yesterdayStart), lt(usersTable.createdAt, todayStart), eq(usersTable.isActivated, true))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, weekStart), eq(usersTable.isActivated, true))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastWeekStart), lt(usersTable.createdAt, weekStart), eq(usersTable.isActivated, true))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, monthStart), eq(usersTable.isActivated, true))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastMonthStart), lt(usersTable.createdAt, monthStart), eq(usersTable.isActivated, true))),
    ]);

    // ── Inactifs inscrits dans la période ─────────────────────────
    const [[todayInact], [yestInact], [weekInact], [lastWeekInact], [monthInact], [lastMonthInact]] = await Promise.all([
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, todayStart), eq(usersTable.isActivated, false))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, yesterdayStart), lt(usersTable.createdAt, todayStart), eq(usersTable.isActivated, false))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, weekStart), eq(usersTable.isActivated, false))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastWeekStart), lt(usersTable.createdAt, weekStart), eq(usersTable.isActivated, false))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, monthStart), eq(usersTable.isActivated, false))),
      db.select({ n: count() }).from(usersTable).where(and(gte(usersTable.createdAt, lastMonthStart), lt(usersTable.createdAt, monthStart), eq(usersTable.isActivated, false))),
    ]);

    const P = 900; // profit par activation

    res.json({
      registrations: {
        today: todayReg?.n ?? 0,      yesterday: yestReg?.n ?? 0,
        thisWeek: weekReg?.n ?? 0,    lastWeek: lastWeekReg?.n ?? 0,
        thisMonth: monthReg?.n ?? 0,  lastMonth: lastMonthReg?.n ?? 0,
      },
      activations: {
        today: todayAct?.n ?? 0,      yesterday: yestAct?.n ?? 0,
        thisWeek: weekAct?.n ?? 0,    lastWeek: lastWeekAct?.n ?? 0,
        thisMonth: monthAct?.n ?? 0,  lastMonth: lastMonthAct?.n ?? 0,
      },
      inactive: {
        today: todayInact?.n ?? 0,     yesterday: yestInact?.n ?? 0,
        thisWeek: weekInact?.n ?? 0,   lastWeek: lastWeekInact?.n ?? 0,
        thisMonth: monthInact?.n ?? 0, lastMonth: lastMonthInact?.n ?? 0,
      },
      revenue: {
        today: (todayAct?.n ?? 0) * P,        yesterday: (yestAct?.n ?? 0) * P,
        thisWeek: (weekAct?.n ?? 0) * P,      lastWeek: (lastWeekAct?.n ?? 0) * P,
        thisMonth: (monthAct?.n ?? 0) * P,    lastMonth: (lastMonthAct?.n ?? 0) * P,
      },
    });
  } catch (err) {
    req.log.error(err, "admin/growth error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/users — liste des utilisateurs (recherche + filtres)
// ─────────────────────────────────────────────────────────────────
router.get("/admin/users", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { q, filter, limit: limitStr, offset: offsetStr } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limitStr ?? "50", 10) || 50, 200);
  const off = parseInt(offsetStr ?? "0", 10) || 0;

  const conditions = [];
  if (q && q.trim()) {
    const pattern = `%${q.trim().toLowerCase()}%`;
    conditions.push(or(ilike(usersTable.email, pattern), ilike(usersTable.displayName, pattern), ilike(usersTable.phone, pattern)));
  }
  if (filter === "active") conditions.push(eq(usersTable.isActivated, true));
  if (filter === "inactive") conditions.push(eq(usersTable.isActivated, false));
  if (filter === "banned") conditions.push(eq(usersTable.isBanned, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      email: usersTable.email,
      phone: usersTable.phone,
      country: usersTable.country,
      isActivated: usersTable.isActivated,
      isBanned: usersTable.isBanned,
      isAdmin: usersTable.isAdmin,
      referralCode: usersTable.referralCode,
      referredByCode: usersTable.referredByCode,
      createdAt: usersTable.createdAt,
      avatarUrl: usersTable.avatarUrl,
      referralBalance: balancesTable.referralBalance,
      taskBalance: balancesTable.taskBalance,
      bonusBalance: balancesTable.bonusBalance,
      depositBalance: balancesTable.depositBalance,
      activityBalance: balancesTable.activityBalance,
      inactiveBalance: balancesTable.inactiveBalance,
      withdrawnAmount: balancesTable.withdrawnAmount,
      spentAmount: balancesTable.spentAmount,
    })
    .from(usersTable)
    .leftJoin(balancesTable, eq(balancesTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(lim)
    .offset(off);

  const [countRow] = await db.select({ total: count() }).from(usersTable).where(where);

  res.json({ users: rows, total: countRow?.total ?? 0, limit: lim, offset: off });
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/users/:id — détail d'un utilisateur
// ─────────────────────────────────────────────────────────────────
router.get("/admin/users/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [user] = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      email: usersTable.email,
      phone: usersTable.phone,
      country: usersTable.country,
      isActivated: usersTable.isActivated,
      isBanned: usersTable.isBanned,
      isAdmin: usersTable.isAdmin,
      referralCode: usersTable.referralCode,
      referredByCode: usersTable.referredByCode,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  const [balances] = await db.select().from(balancesTable).where(eq(balancesTable.userId, id));

  const teamN1 = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email, isActivated: usersTable.isActivated, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.referredByCode, user.referralCode))
    .orderBy(desc(usersTable.createdAt))
    .limit(20);

  const txns = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, id)).orderBy(desc(transactionsTable.createdAt)).limit(20);

  res.json({ user, balances, teamN1, transactions: txns });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id/balances — modifier les soldes
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/balances", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const { referralBalance, taskBalance, bonusBalance, depositBalance, activityBalance, inactiveBalance } = req.body as Record<string, unknown>;

  const updates: Record<string, string> = {};
  const fields: [string, unknown][] = [
    ["referralBalance", referralBalance],
    ["taskBalance", taskBalance],
    ["bonusBalance", bonusBalance],
    ["depositBalance", depositBalance],
    ["activityBalance", activityBalance],
    ["inactiveBalance", inactiveBalance],
  ];

  for (const [key, val] of fields) {
    if (val !== undefined && val !== null && val !== "") {
      const num = parseFloat(String(val));
      if (!Number.isFinite(num) || num < 0) {
        res.status(400).json({ error: `Valeur invalide pour ${key}` });
        return;
      }
      updates[key] = num.toFixed(2);
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucun champ à mettre à jour" });
    return;
  }

  const [existing] = await db.select({ userId: balancesTable.userId }).from(balancesTable).where(eq(balancesTable.userId, id));
  if (!existing) { res.status(404).json({ error: "Soldes introuvables" }); return; }

  const drizzleUpdates: Partial<typeof balancesTable.$inferInsert> = {};
  if (updates.referralBalance !== undefined) drizzleUpdates.referralBalance = updates.referralBalance;
  if (updates.taskBalance !== undefined) drizzleUpdates.taskBalance = updates.taskBalance;
  if (updates.bonusBalance !== undefined) drizzleUpdates.bonusBalance = updates.bonusBalance;
  if (updates.depositBalance !== undefined) drizzleUpdates.depositBalance = updates.depositBalance;
  if (updates.activityBalance !== undefined) drizzleUpdates.activityBalance = updates.activityBalance;
  if (updates.inactiveBalance !== undefined) drizzleUpdates.inactiveBalance = updates.inactiveBalance;

  const [updated] = await db.update(balancesTable).set(drizzleUpdates).where(eq(balancesTable.userId, id)).returning();

  req.log.info({ adminId: req.userId, targetUserId: id, updates }, "[admin] soldes modifiés");
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id/password — modifier le mot de passe
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/password", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères" });
    return;
  }

  const hash = await hashPassword(password);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, id));

  req.log.info({ adminId: req.userId, targetUserId: id }, "[admin] mot de passe modifié");
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id/activate — activer / désactiver manuellement
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/activate", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

    const { activated } = req.body as { activated?: boolean };
    if (typeof activated !== "boolean") {
      res.status(400).json({ error: "Champ 'activated' (boolean) requis" });
      return;
    }

    if (activated) {
      // Activation complète via activateUserTx :
      //   1. UPDATE atomique WHERE is_activated = false (idempotent)
      //   2. Crédit +800 FCFA bonus d'activation
      //   3. Transaction logs (activation + bonus)
      //   4. Commissions N1/N2/N3 si parrainage
      // amount = 0 car l'admin active gratuitement (pas de paiement utilisateur)
      await db.transaction(async (tx) => {
        // Garantit que la ligne balances existe (register la crée normalement,
        // mais on protège contre les comptes créés sans balances)
        await tx.insert(balancesTable).values({ userId: id }).onConflictDoNothing();
        await activateUserTx(tx, id, 0, "admin_manual", req.userId, req.log);
      });
    } else {
      // Désactivation manuelle (pas de remboursement, juste le flag)
      await db.update(usersTable).set({ isActivated: false }).where(eq(usersTable.id, id));
    }

    const [updated] = await db.select({ id: usersTable.id, isActivated: usersTable.isActivated, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id));
    if (!updated) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    req.log.info({ adminId: req.userId, targetUserId: id, activated }, "[admin] statut activation modifié");
    res.json(updated);
  } catch (err) {
    req.log.error(err, "[admin] erreur activation");
    res.status(500).json({ error: "Erreur lors de l'activation" });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id/block — bloquer / débloquer
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/block", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const { banned } = req.body as { banned?: boolean };
  if (typeof banned !== "boolean") {
    res.status(400).json({ error: "Champ 'banned' (boolean) requis" });
    return;
  }

  const [updated] = await db.update(usersTable).set({ isBanned: banned }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, isBanned: usersTable.isBanned, email: usersTable.email });

  if (!updated) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  req.log.info({ adminId: req.userId, targetUserId: id, banned }, "[admin] statut ban modifié");
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// DELETE /admin/users/:id — supprimer un utilisateur
// ─────────────────────────────────────────────────────────────────
router.delete("/admin/users/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  if (id === req.userId) {
    res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    return;
  }

  await db.delete(transactionsTable).where(eq(transactionsTable.userId, id));
  await db.delete(balancesTable).where(eq(balancesTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));

  req.log.warn({ adminId: req.userId, deletedUserId: id }, "[admin] utilisateur supprimé");
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/activity-withdrawals — liste de toutes les conversions activités
// ─────────────────────────────────────────────────────────────────
router.get("/admin/activity-withdrawals", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { filter } = req.query as { filter?: string };

  const conditions = [];
  if (filter && ["pending", "approved", "paid", "rejected"].includes(filter)) {
    conditions.push(eq(activityWithdrawalsTable.status, filter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: activityWithdrawalsTable.id,
      userId: activityWithdrawalsTable.userId,
      amount: activityWithdrawalsTable.amount,
      method: activityWithdrawalsTable.method,
      accountNumber: activityWithdrawalsTable.accountNumber,
      accountName: activityWithdrawalsTable.accountName,
      whatsappNumber: activityWithdrawalsTable.whatsappNumber,
      status: activityWithdrawalsTable.status,
      adminNote: activityWithdrawalsTable.adminNote,
      rejectionReason: activityWithdrawalsTable.rejectionReason,
      createdAt: activityWithdrawalsTable.createdAt,
      approvedAt: activityWithdrawalsTable.approvedAt,
      paidAt: activityWithdrawalsTable.paidAt,
      userEmail: usersTable.email,
      userDisplayName: usersTable.displayName,
    })
    .from(activityWithdrawalsTable)
    .leftJoin(usersTable, eq(usersTable.id, activityWithdrawalsTable.userId))
    .where(where)
    .orderBy(desc(activityWithdrawalsTable.createdAt))
    .limit(200);

  res.json(items);
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/withdrawals/all — liste complète des retraits avec infos user
// ─────────────────────────────────────────────────────────────────
router.get("/admin/withdrawals/all", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { filter } = req.query as { filter?: string };

  const conditions = [];
  if (filter && ["pending", "processing", "completed", "rejected"].includes(filter)) {
    conditions.push(eq(withdrawalsTable.status, filter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: withdrawalsTable.id,
      userId: withdrawalsTable.userId,
      amount: withdrawalsTable.amount,
      method: withdrawalsTable.method,
      accountNumber: withdrawalsTable.accountNumber,
      accountName: withdrawalsTable.accountName,
      source: withdrawalsTable.source,
      status: withdrawalsTable.status,
      rejectionReason: withdrawalsTable.rejectionReason,
      proofUrl: withdrawalsTable.proofUrl,
      createdAt: withdrawalsTable.createdAt,
      processedAt: withdrawalsTable.processedAt,
      userEmail: usersTable.email,
      userDisplayName: usersTable.displayName,
    })
    .from(withdrawalsTable)
    .leftJoin(usersTable, eq(usersTable.id, withdrawalsTable.userId))
    .where(where)
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(200);

  res.json(items);
});

// ─────────────────────────────────────────────────────────────────
// GET /admin/wallet-exposure — besoin de financement par pays
// ─────────────────────────────────────────────────────────────────
router.get("/admin/wallet-exposure", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  // 1. Soldes parrainage agrégés par pays
  const balanceRows = await db
    .select({
      country: usersTable.country,
      userCount:          sql<string>`COUNT(${usersTable.id})`,
      usersWithBalance:   sql<string>`COUNT(CASE WHEN ${balancesTable.referralBalance}::numeric > 0 THEN 1 END)`,
      usersReadyToWithdraw: sql<string>`COUNT(CASE WHEN ${balancesTable.referralBalance}::numeric >= ${PAYOUT_MIN} THEN 1 END)`,
      totalReferralFcfa:  sql<string>`COALESCE(SUM(${balancesTable.referralBalance}::numeric), 0)`,
      eligibleReferralFcfa: sql<string>`COALESCE(SUM(CASE WHEN ${balancesTable.referralBalance}::numeric >= ${PAYOUT_MIN} THEN ${balancesTable.referralBalance}::numeric ELSE 0 END), 0)`,
    })
    .from(usersTable)
    .leftJoin(balancesTable, eq(balancesTable.userId, usersTable.id))
    .where(and(sql`${usersTable.country} IS NOT NULL`, sql`${usersTable.country} != ''`))
    .groupBy(usersTable.country)
    .orderBy(sql`SUM(${balancesTable.referralBalance}::numeric) DESC NULLS LAST`);

  // 2. Retraits en attente/processing par pays
  const pendingRows = await db
    .select({
      country: usersTable.country,
      pendingFcfa: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}::numeric), 0)`,
    })
    .from(withdrawalsTable)
    .innerJoin(usersTable, eq(usersTable.id, withdrawalsTable.userId))
    .where(sql`${withdrawalsTable.status} IN ('pending', 'processing')`)
    .groupBy(usersTable.country);

  const pendingByCountry = Object.fromEntries(
    pendingRows.map(r => [r.country, parseFloat(r.pendingFcfa)])
  );

  // 3. Calculer les montants en devise locale
  const rows = balanceRows.map(r => {
    const country       = r.country ?? "Inconnu";
    const countryCode   = COUNTRY_CODES[country]      ?? "??";
    const currency      = COUNTRY_CURRENCIES[country] ?? "XAF";
    const fxRate        = CURRENCY_RATES[currency]    ?? 1;

    const totalFcfa     = parseFloat(r.totalReferralFcfa);
    const eligibleFcfa  = parseFloat(r.eligibleReferralFcfa);
    const pendingFcfa   = pendingByCountry[country] ?? 0;

    // Montant recommandé = soldes des utilisateurs prêts + retraits en cours + 20% buffer sécurité
    const minimumFcfa   = eligibleFcfa + pendingFcfa;
    const recommendedFcfa = Math.ceil(minimumFcfa * 1.20);

    return {
      country,
      countryCode,
      currency,
      userCount:            parseInt(r.userCount),
      usersWithBalance:     parseInt(r.usersWithBalance),
      usersReadyToWithdraw: parseInt(r.usersReadyToWithdraw),
      totalReferralFcfa:    Math.round(totalFcfa),
      eligibleReferralFcfa: Math.round(eligibleFcfa),
      pendingWithdrawalFcfa: Math.round(pendingFcfa),
      minimumFcfa:          Math.round(minimumFcfa),
      recommendedFcfa:      Math.round(recommendedFcfa),
      // Même chose en devise locale
      totalReferralLocal:    Math.round(totalFcfa    * fxRate),
      eligibleReferralLocal: Math.round(eligibleFcfa * fxRate),
      pendingWithdrawalLocal: Math.round(pendingFcfa * fxRate),
      minimumLocal:          Math.round(minimumFcfa  * fxRate),
      recommendedLocal:      Math.round(recommendedFcfa * fxRate),
    };
  });

  res.json(rows);
});

// ─── GET /admin/formations ─────────────────────────────────────
router.get("/admin/formations", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const { premiumFormationPurchasesTable, freeFormationDownloadsTable } = await import("@workspace/db/schema");

  // Achats formations pro
  const proHistory = await db
    .select({
      id: premiumFormationPurchasesTable.id,
      formationId: premiumFormationPurchasesTable.formationId,
      priceFcfa: premiumFormationPurchasesTable.priceFcfa,
      currency: premiumFormationPurchasesTable.currency,
      priceInCurrency: premiumFormationPurchasesTable.priceInCurrency,
      createdAt: premiumFormationPurchasesTable.createdAt,
      buyerName: usersTable.displayName,
      buyerEmail: usersTable.email,
    })
    .from(premiumFormationPurchasesTable)
    .leftJoin(usersTable, eq(usersTable.id, premiumFormationPurchasesTable.buyerId))
    .orderBy(desc(premiumFormationPurchasesTable.createdAt))
    .limit(300);

  const [proSummary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(price_fcfa::numeric), 0)`,
      totalPurchases: count(),
    })
    .from(premiumFormationPurchasesTable);

  // Téléchargements formations gratuites
  const freeHistory = await db
    .select({
      id: freeFormationDownloadsTable.id,
      formationId: freeFormationDownloadsTable.formationId,
      downloadedAt: freeFormationDownloadsTable.downloadedAt,
      userName: usersTable.displayName,
      userEmail: usersTable.email,
    })
    .from(freeFormationDownloadsTable)
    .leftJoin(usersTable, eq(usersTable.id, freeFormationDownloadsTable.userId))
    .orderBy(desc(freeFormationDownloadsTable.downloadedAt))
    .limit(300);

  const [freeSummary] = await db
    .select({ totalDownloads: count() })
    .from(freeFormationDownloadsTable);

  res.json({
    pro: {
      totalRevenue: parseFloat(proSummary?.totalRevenue ?? "0"),
      totalPurchases: proSummary?.totalPurchases ?? 0,
      history: proHistory,
    },
    free: {
      totalDownloads: freeSummary?.totalDownloads ?? 0,
      history: freeHistory,
    },
  });
});

// ─── GET /admin/contacts-revenue ────────────────────────────────
router.get("/admin/contacts-revenue", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(price_fcfa::numeric), 0)`,
      totalPurchases: count(),
      totalContacts: sql<string>`COALESCE(SUM(quantity), 0)`,
    })
    .from(contactPurchasesTable);

  const history = await db
    .select({
      id: contactPurchasesTable.id,
      buyerId: contactPurchasesTable.buyerId,
      buyerName: usersTable.displayName,
      buyerEmail: usersTable.email,
      quantity: contactPurchasesTable.quantity,
      priceFcfa: contactPurchasesTable.priceFcfa,
      currency: contactPurchasesTable.currency,
      priceInCurrency: contactPurchasesTable.priceInCurrency,
      orderType: contactPurchasesTable.orderType,
      createdAt: contactPurchasesTable.createdAt,
    })
    .from(contactPurchasesTable)
    .leftJoin(usersTable, eq(usersTable.id, contactPurchasesTable.buyerId))
    .orderBy(desc(contactPurchasesTable.createdAt))
    .limit(200);

  res.json({
    totalRevenue: parseFloat(summary?.totalRevenue ?? "0"),
    totalPurchases: summary?.totalPurchases ?? 0,
    totalContacts: parseInt(summary?.totalContacts ?? "0"),
    history,
  });
});

// ─── GET /admin/top-users — classements multi-catégories ─────────
router.get("/admin/top-users", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  // Semaine en cours (lundi matin UTC+1)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Toutes les requêtes utilisent du SQL brut pour éviter les ambiguïtés
  // de référence de colonne que Drizzle génère dans les sous-requêtes corrélées.

  type TopRow = {
    id: number; displayName: string; email: string;
    phone: string | null; avatarUrl: string | null; country: string | null;
    metric: number;
  };

  // Top recruteurs — filleuls directs (N1) uniquement, avec distinction actifs/inactifs
  type RecruiterRow = TopRow & { metricActive: number };
  const topRecruiters = (await db.execute<RecruiterRow>(sql`
    SELECT
      u.id,
      u.display_name   AS "displayName",
      u.email,
      u.phone,
      u.avatar_url     AS "avatarUrl",
      u.country,
      (SELECT COUNT(*)::int FROM users u2 WHERE u2.referred_by_code = u.referral_code)                                      AS metric,
      (SELECT COUNT(*)::int FROM users u2 WHERE u2.referred_by_code = u.referral_code AND u2.is_activated = true)           AS "metricActive"
    FROM users u
    WHERE u.is_activated = true
    ORDER BY metric DESC
    LIMIT 10
  `)).rows;

  // Top activités — points de la semaine en cours
  const topActivities = (await db.execute<TopRow>(sql`
    SELECT
      u.id,
      u.display_name   AS "displayName",
      u.email,
      u.phone,
      u.avatar_url     AS "avatarUrl",
      u.country,
      wp.total_points  AS metric
    FROM weekly_points wp
    INNER JOIN users u ON u.id = wp.user_id
    WHERE wp.week_start = ${weekStartStr}::date
      AND u.is_activated = true
    ORDER BY metric DESC
    LIMIT 10
  `)).rows;

  // Gros soldes — somme de tous les soldes
  const topBalances = (await db.execute<TopRow>(sql`
    SELECT
      u.id,
      u.display_name   AS "displayName",
      u.email,
      u.phone,
      u.avatar_url     AS "avatarUrl",
      u.country,
      (
        COALESCE(b.referral_balance::numeric, 0) +
        COALESCE(b.task_balance::numeric,     0) +
        COALESCE(b.bonus_balance::numeric,    0) +
        COALESCE(b.deposit_balance::numeric,  0) +
        COALESCE(b.activity_balance::numeric, 0)
      ) AS metric
    FROM users u
    INNER JOIN balances b ON b.user_id = u.id
    WHERE u.is_activated = true
    ORDER BY metric DESC
    LIMIT 10
  `)).rows;

  // Gros retraits — montant total retiré
  const topWithdrawals = (await db.execute<TopRow>(sql`
    SELECT
      u.id,
      u.display_name   AS "displayName",
      u.email,
      u.phone,
      u.avatar_url     AS "avatarUrl",
      u.country,
      COALESCE(b.withdrawn_amount::numeric, 0) AS metric
    FROM users u
    INNER JOIN balances b ON b.user_id = u.id
    WHERE u.is_activated = true
    ORDER BY metric DESC
    LIMIT 10
  `)).rows;

  res.json({ recruiters: topRecruiters, activities: topActivities, balances: topBalances, withdrawals: topWithdrawals });
});

// ─── GET /admin/wallet-users — liste des membres avec solde (hors comptes admin)
// Retourne les utilisateurs ayant un solde parrainage > 0, triés par solde décroissant.
// Les comptes administrateurs sont exclus.
// ─────────────────────────────────────────────────────────────────
const ADMIN_ACCOUNT_EMAILS = ["exaucenapopolo2@gmail.com", "mcexauofficiel@gmail.com"];

router.get("/admin/wallet-users", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  type WalletUserRow = {
    id: number;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    country: string | null;
    referralBalance: number;
    activityBalance: number;
    bonusBalance: number;
    depositBalance: number;
    totalBalance: number;
  };

  const rows = (await db.execute<WalletUserRow>(sql`
    SELECT
      u.id,
      u.display_name   AS "displayName",
      u.email,
      u.avatar_url     AS "avatarUrl",
      u.country,
      COALESCE(b.referral_balance::numeric,  0)::int AS "referralBalance",
      COALESCE(b.activity_balance::numeric,  0)::int AS "activityBalance",
      COALESCE(b.bonus_balance::numeric,     0)::int AS "bonusBalance",
      COALESCE(b.deposit_balance::numeric,   0)::int AS "depositBalance",
      (
        COALESCE(b.referral_balance::numeric, 0) +
        COALESCE(b.activity_balance::numeric, 0) +
        COALESCE(b.bonus_balance::numeric,    0) +
        COALESCE(b.deposit_balance::numeric,  0)
      )::int AS "totalBalance"
    FROM users u
    INNER JOIN balances b ON b.user_id = u.id
    WHERE u.email NOT IN (${sql.join(ADMIN_ACCOUNT_EMAILS.map(e => sql`${e}`), sql`, `)})
      AND (
        COALESCE(b.referral_balance::numeric, 0) +
        COALESCE(b.activity_balance::numeric, 0) +
        COALESCE(b.bonus_balance::numeric,    0) +
        COALESCE(b.deposit_balance::numeric,  0)
      ) > 0
    ORDER BY "totalBalance" DESC
    LIMIT 100
  `)).rows;

  res.json(rows);
});

export default router;
