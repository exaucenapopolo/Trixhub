import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, balancesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { getRates } from "../lib/currency";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    isActivated: user.isActivated,
    isAdmin: user.isAdmin,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode ?? null,
    preferredCurrency: user.preferredCurrency,
    themePreference: user.themePreference,
    canvaRequestedAt: user.canvaRequestedAt ? user.canvaRequestedAt.toISOString() : null,
    formationRequestedAt: user.formationRequestedAt ? user.formationRequestedAt.toISOString() : null,
    formationRequestedTitle: user.formationRequestedTitle ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function getLevel1Members(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return [];
  return db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));
}

async function getLevel2Members(userId: number) {
  const l1 = await getLevel1Members(userId);
  const l2: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l1) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l2.push(...members);
  }
  return l2;
}

async function getLevel3Members(userId: number) {
  const l2 = await getLevel2Members(userId);
  const l3: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l2) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l3.push(...members);
  }
  return l3;
}

router.get("/users/me/dashboard", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));
  const referralBalance = parseFloat(balance?.referralBalance ?? "0");
  const taskBalance = parseFloat(balance?.taskBalance ?? "0");
  const inactiveBalance = parseFloat(balance?.inactiveBalance ?? "0");
  const withdrawnAmount = parseFloat(balance?.withdrawnAmount ?? "0");
  const spentAmount = parseFloat(balance?.spentAmount ?? "0");
  const totalBalance = referralBalance + taskBalance;

  const l1 = await getLevel1Members(userId);
  const l2 = await getLevel2Members(userId);
  const l3 = await getLevel3Members(userId);
  const all = [...l1, ...l2, ...l3];

  const rates = getRates();
  const currency = user.preferredCurrency;
  const exchangeRate = rates[currency] ?? 1;

  res.json({
    totalBalance, referralBalance, taskBalance,
    withdrawnAmount, spentAmount, inactiveBalance,
    totalReferrals: all.length,
    activeReferrals: all.filter(m => m.isActivated).length,
    inactiveReferrals: all.filter(m => !m.isActivated).length,
    level1Count: l1.length,
    level2Count: l2.length,
    level3Count: l3.length,
    pendingWithdrawals: 0,
    currency,
    exchangeRate,
  });
});

router.patch("/users/me", authenticate, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof body.displayName === "string") updates.displayName = body.displayName;
  if (typeof body.phone === "string") updates.phone = body.phone;
  if (typeof body.country === "string") updates.country = body.country;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucune donnée à mettre à jour" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

router.patch("/users/me/preferred-currency", authenticate, async (req, res): Promise<void> => {
  const { currency } = req.body as { currency?: string };
  if (!currency || typeof currency !== "string") {
    res.status(400).json({ error: "Devise invalide" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ preferredCurrency: currency })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

router.patch("/users/me/theme", authenticate, async (req, res): Promise<void> => {
  const { theme } = req.body as { theme?: string };
  if (!theme || !["light", "dark"].includes(theme)) {
    res.status(400).json({ error: "Thème invalide (light ou dark)" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ themePreference: theme })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

export default router;
