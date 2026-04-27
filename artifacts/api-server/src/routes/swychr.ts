import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable, swychrTransactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import {
  createPaymentLink,
  checkPaymentStatus,
  verifyWebhookSignature,
  getWebhookUrl,
  ACCOUNTPE,
} from "../lib/swychr";

const router: IRouter = Router();

// Mapping des 18 pays africains supportés par AccountPE (Swychr Connect)
// Vérifié en direct via leur API /api/payout/payout_methods
const COUNTRY_CODES: Record<string, string> = {
  "Bénin": "BJ", "Burkina Faso": "BF", "Cameroun": "CM",
  "Côte d'Ivoire": "CI", "Congo-Brazzaville": "CG", "RD Congo": "CD",
  "Gabon": "GA", "Ghana": "GH", "Guinée": "GN", "Kenya": "KE",
  "Mali": "ML", "Niger": "NE", "Nigeria": "NG",
  "Rwanda": "RW", "Sénégal": "SN", "Togo": "TG", "Tanzanie": "TZ",
  "Ouganda": "UG",
};

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    isActivated: user.isActivated,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode ?? null,
    preferredCurrency: user.preferredCurrency,
    themePreference: user.themePreference,
    createdAt: user.createdAt.toISOString(),
  };
}

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/swychr/initiate — Créer un lien de paiement AccountPE
// ─────────────────────────────────────────────────────────────────
router.post("/swychr/initiate", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(401).json({ success: false, error: "Utilisateur introuvable" }); return; }

  if (user.isActivated) {
    res.status(400).json({ success: false, error: "Compte déjà activé" });
    return;
  }

  const { phoneNumber: customPhone } = req.body as { phoneNumber?: string };

  const transactionId = `TRIX-${Date.now()}-${user.id}`;
  const countryCode = COUNTRY_CODES[user.country] || "CM";
  const callbackUrl = getWebhookUrl();
  // Utiliser le numéro fourni par l'utilisateur (modifié dans le formulaire) ou celui du profil
  const mobile = (customPhone || user.phone).replace(/\D/g, "");
  const name = user.displayName || deriveDisplayName(user.email);

  req.log.info({ transactionId, callbackUrl, countryCode }, "[AccountPE] Initiating payment link");

  try {
    const { paymentLink, id } = await createPaymentLink({
      countryCode,
      name,
      email: user.email,
      mobile,
      amount: 3600,
      currency: "XAF",
      transactionId,
      description: "Activation compte TRIXHUB",
      callbackUrl,
    });

    await db.insert(swychrTransactionsTable).values({
      userId: user.id,
      paymentRef: transactionId,
      swychrRef: id,
      amount: "3600.00",
      currency: "XAF",
      phoneNumber: user.phone,
      paymentMethod: "accountpe_checkout",
      status: "pending",
      purpose: "activation",
      paymentUrl: paymentLink,
    });

    res.json({ success: true, transactionId, checkoutUrl: paymentLink });
  } catch (err) {
    req.log.error({ err }, "[AccountPE] createPaymentLink error");
    res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : "Erreur AccountPE",
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/swychr/status/:txId — Vérifier le statut du paiement
// ─────────────────────────────────────────────────────────────────
router.get("/swychr/status/:txId", authenticate, async (req, res): Promise<void> => {
  const { txId } = req.params;

  const [tx] = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.paymentRef, txId));

  if (!tx || tx.userId !== req.userId!) {
    res.status(404).json({ success: false, error: "Transaction introuvable" });
    return;
  }

  if (tx.status === "SUCCESS") {
    res.json({ success: true, status: "success", isPaid: true });
    return;
  }
  if (tx.status === "FAILED") {
    res.json({ success: true, status: "failed", isPaid: false });
    return;
  }

  // Vérifier en temps réel chez AccountPE
  try {
    const { status } = await checkPaymentStatus(txId);

    if (status === "success" && tx.status !== "SUCCESS") {
      await handlePaymentSuccess(txId, tx.userId, 3600, "polling", req.log);
    } else if (status === "failed" && tx.status !== "FAILED") {
      await db
        .update(swychrTransactionsTable)
        .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(swychrTransactionsTable.paymentRef, txId));
    }

    res.json({ success: true, status, isPaid: status === "success" });
  } catch (err) {
    req.log.error({ err }, "[AccountPE] status check error");
    res.json({ success: true, status: "pending", isPaid: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/accountpe/webhook  &  /api/webhook/swychr (alias)
// AccountPE appelle cette URL pour confirmer un paiement
// ─────────────────────────────────────────────────────────────────
async function handleWebhook(req: import("express").Request, res: import("express").Response): Promise<void> {
  res.status(200).json({ received: true });

  try {
    const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    const signature = (
      req.headers["x-accountpe-signature"] ||
      req.headers["x-swychr-signature"] ||
      req.headers["x-signature"] || ""
    ) as string;

    if (ACCOUNTPE.webhookSecret && signature) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        req.log.error("[AccountPE] Signature webhook invalide");
        return;
      }
    }

    const payload = req.body as Record<string, unknown>;
    req.log.info({ payload }, "[AccountPE] Webhook reçu");

    const transactionId = (payload.transaction_id || payload.reference || payload.ref) as string | undefined;
    if (!transactionId) { req.log.warn("[AccountPE] Webhook sans transaction_id"); return; }

    // Toujours vérifier via l'API de statut — ne jamais faire confiance au webhook seul
    const { status } = await checkPaymentStatus(transactionId);
    req.log.info({ transactionId, status }, "[AccountPE] Statut vérifié après webhook");

    if (status === "success") {
      const [tx] = await db
        .select()
        .from(swychrTransactionsTable)
        .where(eq(swychrTransactionsTable.paymentRef, transactionId));
      if (tx) {
        await handlePaymentSuccess(transactionId, tx.userId, parseFloat(tx.amount), "webhook", req.log);
      }
    } else if (status === "failed" || status === "refunded") {
      await db
        .update(swychrTransactionsTable)
        .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(swychrTransactionsTable.paymentRef, transactionId));
    }
  } catch (err) {
    req.log.error({ err }, "[AccountPE] Webhook error");
  }
}

router.post("/accountpe/webhook", handleWebhook);
router.post("/webhook/swychr", handleWebhook);

// ─────────────────────────────────────────────────────────────────
// Activation du compte après paiement confirmé (idempotente)
// ─────────────────────────────────────────────────────────────────
async function handlePaymentSuccess(
  transactionId: string,
  userId: number,
  amount: number,
  source: string,
  log: import("pino").Logger
) {
  const [existing] = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.paymentRef, transactionId));

  // Idempotence : déjà traité
  if (!existing || existing.status === "SUCCESS") return;

  await db
    .update(swychrTransactionsTable)
    .set({ status: "SUCCESS", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(swychrTransactionsTable.paymentRef, transactionId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.isActivated) return;

  await db.update(usersTable).set({ isActivated: true }).where(eq(usersTable.id, userId));

  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));
  if (balance) {
    const spent = parseFloat(balance.spentAmount ?? "0") + amount;
    await db.update(balancesTable).set({ spentAmount: spent.toFixed(2) }).where(eq(balancesTable.userId, userId));
  }

  await db.insert(transactionsTable).values({
    userId,
    type: "activation",
    amount: `-${amount.toFixed(2)}`,
    description: `Activation compte TRIXHUB via AccountPE (${source})`,
    status: "completed",
  });

  log.info({ userId, transactionId, source }, "[AccountPE] ✅ Compte activé");

  // Commissions parrain
  if (user.referredByCode) {
    await creditCommission(user, 1700, 1, user.referredByCode, log);
    const [ref1] = await db.select().from(usersTable).where(eq(usersTable.referralCode, user.referredByCode));
    if (ref1?.referredByCode) {
      await creditCommission(user, 700, 2, ref1.referredByCode, log);
      const [ref2] = await db.select().from(usersTable).where(eq(usersTable.referralCode, ref1.referredByCode));
      if (ref2?.referredByCode) {
        await creditCommission(user, 300, 3, ref2.referredByCode, log);
      }
    }
  }
}

async function creditCommission(
  activatedUser: typeof usersTable.$inferSelect,
  commission: number,
  level: number,
  referrerCode: string,
  log: import("pino").Logger
) {
  const [ref] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referrerCode));
  if (!ref) return;
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.userId, ref.id));
  if (!bal) return;

  const inactive = Math.max(0, parseFloat(bal.inactiveBalance ?? "0") - commission);
  const referral = parseFloat(bal.referralBalance ?? "0") + commission;

  await db.update(balancesTable)
    .set({ inactiveBalance: inactive.toFixed(2), referralBalance: referral.toFixed(2) })
    .where(eq(balancesTable.userId, ref.id));

  const name = activatedUser.displayName || deriveDisplayName(activatedUser.email);
  await db.insert(transactionsTable).values({
    userId: ref.id,
    type: `referral_l${level}`,
    amount: commission.toFixed(2),
    description: `Commission N${level}: ${name} a activé son compte (+${commission.toLocaleString("fr-FR")} FCFA)`,
    relatedUserId: activatedUser.id,
    level,
    status: "completed",
  });

  log.info({ refId: ref.id, commission, level }, "[AccountPE] Commission créditée");
}

export default router;
