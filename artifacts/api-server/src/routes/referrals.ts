import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

function formatReferralUser(user: typeof usersTable.$inferSelect, level: number) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    isActivated: user.isActivated,
    joinedAt: user.createdAt.toISOString(),
    level,
  };
}

async function getUserByReferralCode(code: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.referralCode, code));
  return user;
}

router.get("/referrals/team", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
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

  res.json({
    total: allFormatted.length,
    active,
    inactive,
    members: allFormatted,
  });
});

router.get("/referrals/level/:level", authenticate, async (req, res): Promise<void> => {
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

  const commissions = { 1: 1700, 2: 700, 3: 300 };
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
  const active = formatted.filter(m => m.isActivated).length;
  const inactive = formatted.filter(m => !m.isActivated).length;

  res.json({
    level,
    commission,
    total: formatted.length,
    active,
    inactive,
    members: formatted,
  });
});

router.get("/referrals/activity", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const transactions = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(transactionsTable.createdAt)
    .limit(20);

  const activity = transactions.reverse().map(t => ({
    id: t.id,
    type: t.type,
    message: t.description,
    amount: t.amount ? parseFloat(t.amount) : null,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json(activity);
});

export default router;
