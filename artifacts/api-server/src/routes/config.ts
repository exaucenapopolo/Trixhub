import { Router, type IRouter } from "express";
import { getRates } from "../lib/currency";
import { getPayoutMethods, getPayoutFee, COUNTRY_CODES, PAYOUT_FEE_BASE, PAYOUT_MIN } from "../lib/swychr";
import { authenticate } from "../middlewares/authenticate";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Barème de frais : paliers visibles à tous (pour l'UI)
const PAYOUT_FEE_TIERS = [
  { upTo: 9_999,     fee: 550 },
  { upTo: 19_999,    fee: 750 },
  { upTo: 49_999,    fee: 1_000 },
  { upTo: 99_999,    fee: 1_500 },
  { upTo: 199_999,   fee: 2_000 },
  { upTo: 499_999,   fee: 2_500 },
  { upTo: 999_999,   fee: 3_000 },
  { upTo: Infinity,  fee: 4_000 },
];

router.get("/config/platform", async (_req, res): Promise<void> => {
  res.json({
    activationFee: 3600,
    level1Commission: 1700,
    level2Commission: 700,
    level3Commission: 200,
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
// Méthodes de secours par pays (utilisées si AccountPE est lent/indisponible)
// Les IDs suivent le format documenté de l'API AccountPE.
// ─────────────────────────────────────────────────────────────────
// IDs utilisés tels quels dans le champ payout_method d'AccountPE.
// Format réel confirmé depuis l'API : "MTN", "Orange", "Wave", etc.
const FALLBACK_METHODS: Record<string, { id: string; name: string }[]> = {
  CM: [
    { id: "MTN",    name: "MTN Mobile Money" },
    { id: "Orange", name: "Orange Money" },
  ],
  CI: [
    { id: "MTN",    name: "MTN MoMo" },
    { id: "Orange", name: "Orange Money" },
    { id: "Wave",   name: "Wave" },
    { id: "Moov",   name: "Moov Money" },
  ],
  SN: [
    { id: "Wave",   name: "Wave" },
    { id: "Orange", name: "Orange Money" },
    { id: "Free",   name: "Free Money" },
  ],
  ML: [
    { id: "Orange", name: "Orange Money" },
    { id: "Wave",   name: "Wave" },
    { id: "Moov",   name: "Moov Money" },
  ],
  BF: [
    { id: "Orange", name: "Orange Money" },
    { id: "Moov",   name: "Moov Money" },
    { id: "Wave",   name: "Wave" },
  ],
  TG: [
    { id: "Tmoney", name: "T-Money" },
    { id: "Moov",   name: "Flooz (Moov)" },
  ],
  BJ: [
    { id: "MTN",    name: "MTN Mobile Money" },
    { id: "Moov",   name: "Moov Money" },
  ],
  GN: [
    { id: "Orange", name: "Orange Money" },
    { id: "MTN",    name: "MTN Mobile Money" },
  ],
  GH: [
    { id: "MTN",       name: "MTN Mobile Money" },
    { id: "Vodafone",  name: "Vodafone Cash" },
  ],
  NG: [
    { id: "MTN",    name: "MTN Mobile Money" },
  ],
  CD: [
    { id: "Airtel", name: "Airtel Money" },
    { id: "Orange", name: "Orange Money" },
  ],
  CG: [
    { id: "Airtel", name: "Airtel Money" },
    { id: "MTN",    name: "MTN Mobile Money" },
  ],
  GA: [
    { id: "Airtel", name: "Airtel Money" },
  ],
};

function getFallbackMethods(countryCode: string): { id: string; name: string; country: string }[] {
  const list = FALLBACK_METHODS[countryCode] ?? [
    { id: "MTN",    name: "MTN Mobile Money" },
    { id: "Orange", name: "Orange Money" },
  ];
  return list.map(m => ({ ...m, country: countryCode }));
}

// ─────────────────────────────────────────────────────────────────
// GET /api/config/payout-methods — méthodes de paiement disponibles
// selon le pays de l'utilisateur (récupérées depuis AccountPE)
// Réponse garantie en moins de 12s grâce au timeout + fallback.
// ─────────────────────────────────────────────────────────────────
const PAYOUT_METHODS_TIMEOUT_MS = 12_000;

router.get("/config/payout-methods", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const countryCode = COUNTRY_CODES[user.country] || "CM";

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), PAYOUT_METHODS_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([
      getPayoutMethods(countryCode),
      timeout,
    ]);

    if (!result) {
      req.log.warn({ countryCode }, "[AccountPE] getPayoutMethods timeout — fallback utilisé");
      res.json({ countryCode, methods: getFallbackMethods(countryCode), fallback: true });
      return;
    }

    const methods = result.length > 0 ? result : getFallbackMethods(countryCode);
    res.json({ countryCode, methods, fallback: result.length === 0 });
  } catch (err) {
    req.log.warn({ err, countryCode }, "[AccountPE] getPayoutMethods error — fallback utilisé");
    res.json({ countryCode, methods: getFallbackMethods(countryCode), fallback: true });
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
