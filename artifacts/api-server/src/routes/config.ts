import { Router, type IRouter } from "express";
import { getRates } from "../lib/currency";
import { getPayoutMethods, getPayoutFee, COUNTRY_CODES, PAYOUT_FEE_BASE, PAYOUT_MIN } from "../lib/swychr";
import { authenticate } from "../middlewares/authenticate";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Barème de frais : paliers visibles à tous (pour l'UI)
const PAYOUT_FEE_TIERS = [
  { upTo: 9_999,   fee: 550 },
  { upTo: 19_999,  fee: 750 },
  { upTo: 49_999,  fee: 1_000 },
  { upTo: 99_999,  fee: 1_500 },
  { upTo: Infinity, fee: 2_000 },
];

router.get("/config/platform", async (_req, res): Promise<void> => {
  res.json({
    activationFee: 3600,
    level1Commission: 1700,
    level2Commission: 700,
    level3Commission: 300,
    minimumWithdrawal: PAYOUT_MIN,
    payoutFeeBase: PAYOUT_FEE_BASE,
    payoutFeeTiers: PAYOUT_FEE_TIERS,
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

// ─────────────────────────────────────────────────────────────────
// GET /api/config/payout-fee?amount=5000 — calcul des frais pour un montant donné
// ─────────────────────────────────────────────────────────────────
router.get("/config/payout-fee", authenticate, async (req, res): Promise<void> => {
  const amount = parseFloat(String(req.query.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Montant invalide" });
    return;
  }
  const fee = getPayoutFee(amount);
  res.json({ amount, fee, amountAfterFee: Math.max(0, amount - fee) });
});

export default router;
