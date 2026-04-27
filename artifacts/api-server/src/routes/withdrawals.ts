import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, balancesTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { RequestWithdrawalBody } from "@workspace/api-zod";

const MIN_WITHDRAWAL = 3000;

const router: IRouter = Router();

function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  return {
    id: w.id,
    amount: parseFloat(w.amount),
    method: w.method,
    accountNumber: w.accountNumber,
    accountName: w.accountName,
    status: w.status,
    requestedAt: w.createdAt.toISOString(),
    processedAt: w.processedAt ? w.processedAt.toISOString() : null,
  };
}

router.get("/withdrawals", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const withdrawals = await db.select().from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt));

  res.json(withdrawals.map(formatWithdrawal));
});

router.post("/withdrawals", authenticate, requireActivation, async (req, res): Promise<void> => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, method, accountNumber, accountName } = parsed.data;

  if (amount < MIN_WITHDRAWAL) {
    res.status(400).json({ error: `Le montant minimum de retrait est de ${MIN_WITHDRAWAL} FCFA` });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || !user.isActivated) {
    res.status(400).json({ error: "Votre compte doit être activé pour effectuer un retrait" });
    return;
  }

  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, req.userId!));
  const available = parseFloat(balance?.referralBalance ?? "0") + parseFloat(balance?.taskBalance ?? "0");

  if (amount > available) {
    res.status(400).json({ error: `Solde insuffisant. Solde disponible: ${available.toFixed(0)} FCFA` });
    return;
  }

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId: req.userId!,
    amount: amount.toFixed(2),
    method,
    accountNumber,
    accountName,
    status: "pending",
  }).returning();

  const newReferralBalance = Math.max(0, parseFloat(balance.referralBalance ?? "0") - amount);
  const newWithdrawn = parseFloat(balance.withdrawnAmount ?? "0") + amount;

  await db.update(balancesTable)
    .set({
      referralBalance: newReferralBalance.toFixed(2),
      withdrawnAmount: newWithdrawn.toFixed(2),
    })
    .where(eq(balancesTable.userId, req.userId!));

  await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: "withdrawal",
    amount: `-${amount.toFixed(2)}`,
    description: `Demande de retrait via ${method}`,
    status: "pending",
  });

  req.log.info({ userId: req.userId, amount }, "Withdrawal requested");
  res.status(201).json(formatWithdrawal(withdrawal));
});

export default router;
