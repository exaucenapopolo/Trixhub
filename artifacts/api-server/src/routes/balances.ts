import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, balancesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { getRates } from "../lib/currency";

const router: IRouter = Router();

router.get("/balances", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));

  const rates = getRates();
  const currency = user?.preferredCurrency ?? "FCFA";
  const exchangeRate = rates[currency] ?? 1;

  res.json({
    totalBalance: parseFloat(balance?.referralBalance ?? "0") + parseFloat(balance?.taskBalance ?? "0"),
    referralBalance: parseFloat(balance?.referralBalance ?? "0"),
    taskBalance: parseFloat(balance?.taskBalance ?? "0"),
    inactiveBalance: parseFloat(balance?.inactiveBalance ?? "0"),
    withdrawnAmount: parseFloat(balance?.withdrawnAmount ?? "0"),
    spentAmount: parseFloat(balance?.spentAmount ?? "0"),
    minimumWithdrawal: 3000,
    currency,
    exchangeRate,
  });
});

export default router;
