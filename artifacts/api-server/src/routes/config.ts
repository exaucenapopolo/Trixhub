import { Router, type IRouter } from "express";
import { getRates } from "../lib/currency";
import { getPayoutMethods, COUNTRY_CODES, PAYOUT_FEE, PAYOUT_MIN } from "../lib/swychr";
import { authenticate } from "../middlewares/authenticate";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/config/platform", async (_req, res): Promise<void> => {
  res.json({
    activationFee: 3600,
    level1Commission: 1700,
    level2Commission: 700,
    level3Commission: 300,
    minimumWithdrawal: PAYOUT_MIN,
    payoutFee: PAYOUT_FEE,
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

// ─────────────────────────────────────────────────────────────────
// GET /api/config/payout-methods — méthodes de paiement disponibles
// selon le pays de l'utilisateur (récupérées depuis AccountPE)
// ─────────────────────────────────────────────────────────────────
router.get("/config/payout-methods", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const countryCode = COUNTRY_CODES[user.country] || "CM";

  try {
    const methods = await getPayoutMethods(countryCode);
    res.json({ countryCode, methods });
  } catch (err) {
    req.log.warn({ err, countryCode }, "[AccountPE] getPayoutMethods error — méthodes par défaut");
    res.json({
      countryCode,
      methods: [
        { id: "mtn_" + countryCode.toLowerCase(), name: "MTN Mobile Money", country: countryCode },
        { id: "orange_" + countryCode.toLowerCase(), name: "Orange Money", country: countryCode },
      ],
    });
  }
});

export default router;
