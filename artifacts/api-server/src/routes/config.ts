import { Router, type IRouter } from "express";
import { getRates } from "../lib/currency";

const router: IRouter = Router();

router.get("/config/platform", async (_req, res): Promise<void> => {
  res.json({
    activationFee: 3600,
    level1Commission: 1700,
    level2Commission: 700,
    level3Commission: 300,
    minimumWithdrawal: 3000,
    currency: "FCFA",
  });
});

router.get("/currency/rates", async (_req, res): Promise<void> => {
  const rates = getRates();
  res.json({
    baseCurrency: "FCFA",
    rates,
    updatedAt: new Date().toISOString(),
  });
});

export default router;
