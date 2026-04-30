import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql, and, count } from "drizzle-orm";
import {
  db,
  usersTable,
  balancesTable,
  withdrawalsTable,
  activityWithdrawalsTable,
  transactionsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/requireAdmin";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

const PROFIT_PER_ACTIVATION = 900;

// ─────────────────────────────────────────────────────────────────
// GET /admin/stats — tableau de bord global
// ─────────────────────────────────────────────────────────────────
router.get("/admin/stats", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const [totalRow] = await db.select({ total: count() }).from(usersTable);
  const [activeRow] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isActivated, true));
  const [bannedRow] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isBanned, true));
  const [pendingWRow] = await db.select({ total: count(), sum: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [processingWRow] = await db.select({ total: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "processing"));
  const [pendingAWRow] = await db.select({ total: count() }).from(activityWithdrawalsTable).where(eq(activityWithdrawalsTable.status, "pending"));
  const [approvedAWRow] = await db.select({ total: count() }).from(activityWithdrawalsTable).where(eq(activityWithdrawalsTable.status, "approved"));
  const [totalWithdrawnRow] = await db.select({ sum: sql<string>`COALESCE(SUM(amount::numeric),0)` }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "completed"));
  const [totalActivationsRevRow] = await db.select({ sum: sql<string>`COALESCE(SUM(spent_amount::numeric),0)` }).from(balancesTable);

  const total = totalRow?.total ?? 0;
  const active = activeRow?.total ?? 0;
  const inactive = total - active;
  const banned = bannedRow?.total ?? 0;
  const companyProfit = active * PROFIT_PER_ACTIVATION;

  res.json({
    users: { total, active, inactive, banned },
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
      totalRevenue: parseFloat(totalActivationsRevRow?.sum ?? "0"),
      profitPerActivation: PROFIT_PER_ACTIVATION,
    },
  });
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
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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
// PATCH /admin/users/:id/block — bloquer / débloquer
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id/block", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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

export default router;
