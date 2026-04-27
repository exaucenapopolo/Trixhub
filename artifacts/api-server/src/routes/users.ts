import { Router, type IRouter } from "express";
import { eq, count, and, sql } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { UpdateProfileBody, UpdatePreferredCurrencyBody } from "@workspace/api-zod";
import { getRates } from "../lib/currency";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    isActivated: user.isActivated,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode ?? null,
    preferredCurrency: user.preferredCurrency,
    createdAt: user.createdAt.toISOString(),
  };
}

async function getLevel1Members(userId: number) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user.length) return [];
  const referralCode = user[0].referralCode;
  return db.select().from(usersTable).where(eq(usersTable.referredByCode, referralCode));
}

async function getLevel2Members(userId: number) {
  const l1 = await getLevel1Members(userId);
  if (!l1.length) return [];
  const l2: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l1) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l2.push(...members);
  }
  return l2;
}

async function getLevel3Members(userId: number) {
  const l2 = await getLevel2Members(userId);
  if (!l2.length) return [];
  const l3: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l2) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l3.push(...members);
  }
  return l3;
}

router.get("/users/me/dashboard", authenticate, async (req, res): Promise<void> => {
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

  const l1Members = await getLevel1Members(userId);
  const l2Members = await getLevel2Members(userId);
  const l3Members = await getLevel3Members(userId);

  const allMembers = [...l1Members, ...l2Members, ...l3Members];
  const activeCount = allMembers.filter(m => m.isActivated).length;
  const inactiveCount = allMembers.filter(m => !m.isActivated).length;

  const rates = getRates();
  const currency = user.preferredCurrency;
  const exchangeRate = rates[currency] ?? 1;

  res.json({
    totalBalance,
    referralBalance,
    taskBalance,
    withdrawnAmount,
    spentAmount,
    inactiveBalance,
    totalReferrals: allMembers.length,
    activeReferrals: activeCount,
    inactiveReferrals: inactiveCount,
    level1Count: l1Members.length,
    level2Count: l2Members.length,
    level3Count: l3Members.length,
    pendingWithdrawals: 0,
    currency,
    exchangeRate,
  });
});

router.patch("/users/me", authenticate, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferSelect> = {};
  if (parsed.data.firstName != null) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName != null) updates.lastName = parsed.data.lastName;
  if (parsed.data.phone != null) updates.phone = parsed.data.phone;
  if (parsed.data.country != null) updates.country = parsed.data.country;

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

router.patch("/users/me/preferred-currency", authenticate, async (req, res): Promise<void> => {
  const parsed = UpdatePreferredCurrencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ preferredCurrency: parsed.data.currency })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

export default router;
