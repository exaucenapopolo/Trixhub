import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { db, usersTable, balancesTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { RequestWithdrawalBody } from "@workspace/api-zod";

const MIN_REFERRAL = 3000;
const MIN_TASK = 3500;

const router: IRouter = Router();

function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  return {
    id: w.id,
    amount: parseFloat(w.amount),
    method: w.method,
    accountNumber: w.accountNumber,
    accountName: w.accountName,
    source: w.source ?? "referral",
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

  const { amount, method, accountNumber, accountName, source } = parsed.data;
  const src = source === "task" ? "task" : "referral";
  const minAmount = src === "task" ? MIN_TASK : MIN_REFERRAL;

  if (amount < minAmount) {
    res.status(400).json({
      error: `Le montant minimum de retrait pour ce solde est de ${minAmount} FCFA`,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || !user.isActivated) {
    res.status(400).json({ error: "Votre compte doit être activé pour effectuer un retrait" });
    return;
  }

  // Tout dans une seule transaction DB : décrement conditionnel + insert withdrawal + insert transaction.
  // Si quoi que ce soit échoue, le solde n'est pas débité.
  const sourceColumn = src === "task" ? balancesTable.taskBalance : balancesTable.referralBalance;
  const userId = req.userId!;

  type TxResult =
    | { ok: true; withdrawal: typeof withdrawalsTable.$inferSelect }
    | { ok: false; available: number };

  const result = await db.transaction(async (tx): Promise<TxResult> => {
    const decrementSql = src === "task"
      ? { taskBalance: sql`(${balancesTable.taskBalance})::numeric - ${amount.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${amount.toFixed(2)}::numeric` }
      : { referralBalance: sql`(${balancesTable.referralBalance})::numeric - ${amount.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${amount.toFixed(2)}::numeric` };

    const updated = await tx.update(balancesTable)
      .set(decrementSql)
      .where(and(
        eq(balancesTable.userId, userId),
        gte(sql`(${sourceColumn})::numeric`, sql`${amount.toFixed(2)}::numeric`),
      ))
      .returning();

    if (updated.length === 0) {
      const [b] = await tx.select().from(balancesTable).where(eq(balancesTable.userId, userId));
      const available = b ? parseFloat(src === "task" ? b.taskBalance : b.referralBalance) : 0;
      return { ok: false, available };
    }

    const [withdrawal] = await tx.insert(withdrawalsTable).values({
      userId,
      amount: amount.toFixed(2),
      method,
      accountNumber,
      accountName,
      source: src,
      status: "pending",
    }).returning();

    await tx.insert(transactionsTable).values({
      userId,
      type: "withdrawal",
      amount: `-${amount.toFixed(2)}`,
      description: `Retrait ${src === "task" ? "missions" : "parrainage"} via ${method}`,
      status: "pending",
    });

    return { ok: true, withdrawal };
  });

  if (!result.ok) {
    res.status(400).json({
      error: `Solde ${src === "task" ? "missions" : "parrainage"} insuffisant`,
      available: result.available,
      source: src,
    });
    return;
  }

  req.log.info({ userId, amount, source: src }, "Withdrawal requested");
  res.status(201).json(formatWithdrawal(result.withdrawal));
});

export default router;
