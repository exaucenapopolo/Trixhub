import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, usersTable, swychrTransactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { paymentLimiter } from "../middlewares/rateLimiters";
import {
  createPaymentLink,
  checkPaymentStatus,
  verifyWebhookSignature,
  getWebhookUrl,
  ACCOUNTPE,
  COUNTRY_CODES,
  COUNTRY_CURRENCIES,
  convertFcfaToPayin,
} from "../lib/swychr";
import { ACTIVATION_AMOUNT, FREE_ACTIVATION_THRESHOLD } from "../lib/activation";
import { handlePaymentSuccess } from "../lib/paymentProcessor";

const router: IRouter = Router();

const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 5_000_000;
const CHILD_ACTIVATION_AMOUNT = ACTIVATION_AMOUNT;

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/swychr/initiate
// Crée un lien de paiement AccountPE pour 4 cas d'usage :
//   purpose = "activation"        : activer son propre compte (3600)
//           = "deposit"           : recharger son solde dépôt (montant libre)
//           = "child_activation"  : activer un filleul N1 inactif (3600)
// Comptes gratuits : peuvent utiliser deposit et child_activation.
// ─────────────────────────────────────────────────────────────────
router.post("/swychr/initiate", authenticate, paymentLimiter, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(401).json({ success: false, error: "Utilisateur introuvable" }); return; }

  const body = req.body as {
    purpose?: "activation" | "deposit" | "child_activation" | "free_self_activation";
    amount?: number;
    childId?: number;
    phoneNumber?: string;
  };
  const purpose = body.purpose ?? "activation";

  let amount: number;
  let targetUserId: number;
  let description: string;

  if (purpose === "activation") {
    if (user.isActivated) {
      res.status(400).json({ success: false, error: "Compte déjà activé" });
      return;
    }
    amount = ACTIVATION_AMOUNT;
    targetUserId = user.id;
    description = "Activation compte TRIXHUB";
  } else if (purpose === "deposit") {
    // Comptes gratuits autorisés à déposer de l'argent
    if (!user.isActivated && !user.isFreeAccount) {
      res.status(403).json({ success: false, error: "Activez votre compte pour faire un dépôt" });
      return;
    }
    const a = Number(body.amount);
    if (!Number.isFinite(a) || a < MIN_DEPOSIT || a > MAX_DEPOSIT) {
      res.status(400).json({ success: false, error: `Montant invalide (min ${MIN_DEPOSIT}, max ${MAX_DEPOSIT.toLocaleString("fr-FR")} FCFA)` });
      return;
    }
    amount = Math.round(a);
    targetUserId = user.id;
    description = `Dépôt TRIXHUB de ${amount.toLocaleString("fr-FR")} FCFA`;
  } else if (purpose === "child_activation") {
    // Comptes gratuits autorisés à activer leurs filleuls
    if (!user.isActivated && !user.isFreeAccount) {
      res.status(403).json({ success: false, error: "Activez votre compte d'abord" });
      return;
    }
    const childId = Number(body.childId);
    if (!Number.isFinite(childId) || childId <= 0) {
      res.status(400).json({ success: false, error: "ID filleul invalide" });
      return;
    }
    const [child] = await db.select().from(usersTable).where(eq(usersTable.id, childId));
    if (!child) {
      res.status(404).json({ success: false, error: "Filleul introuvable" });
      return;
    }
    if (child.referredByCode !== user.referralCode) {
      res.status(403).json({ success: false, error: "Ce membre n'est pas votre filleul direct" });
      return;
    }
    if (child.isActivated) {
      res.status(400).json({ success: false, error: "Ce filleul est déjà activé" });
      return;
    }
    amount = CHILD_ACTIVATION_AMOUNT;
    targetUserId = child.id;
    description = `Activation filleul ${child.displayName || deriveDisplayName(child.email)}`;
  } else if (purpose === "free_self_activation") {
    if (!user.isFreeAccount) {
      res.status(403).json({ success: false, error: "Réservé aux comptes gratuits" });
      return;
    }
    if (user.isActivated) {
      res.status(400).json({ success: false, error: "Compte déjà activé" });
      return;
    }
    const credit = parseFloat(user.activationCredit ?? "0");
    const remainder = Math.max(0, FREE_ACTIVATION_THRESHOLD - credit);
    if (remainder <= 0) {
      res.status(400).json({ success: false, error: "Crédit suffisant — votre compte va s'activer automatiquement" });
      return;
    }
    amount = Math.ceil(remainder);
    targetUserId = user.id;
    description = `Solde restant activation compte gratuit TRIXHUB (${amount.toLocaleString("fr-FR")} FCFA)`;
  } else {
    res.status(400).json({ success: false, error: "purpose invalide" });
    return;
  }

  const transactionId = `TRIX-${Date.now()}-${user.id}`;
  const countryCode = COUNTRY_CODES[user.country] || "CM";
  const callbackUrl = getWebhookUrl();
  const mobile = (body.phoneNumber || user.phone).replace(/\D/g, "");
  const name = user.displayName || deriveDisplayName(user.email);

  const payCurrency = COUNTRY_CURRENCIES[user.country] || "XAF";
  const payAmount   = convertFcfaToPayin(amount, payCurrency);

  req.log.info({ transactionId, purpose, amount, payAmount, payCurrency, targetUserId }, "[AccountPE] initiate");

  try {
    const { paymentLink, id } = await createPaymentLink({
      countryCode,
      name,
      email: user.email,
      mobile,
      amount:   payAmount,
      currency: payCurrency,
      transactionId,
      description,
      callbackUrl,
    });

    await db.insert(swychrTransactionsTable).values({
      userId: user.id,
      targetUserId,
      paymentRef: transactionId,
      swychrRef: id,
      amount: amount.toFixed(2),
      currency: "XAF",
      phoneNumber: user.phone,
      paymentMethod: "accountpe_checkout",
      status: "pending",
      purpose,
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
// GET /api/swychr/pending — Transactions en attente de l'utilisateur
// Permet au frontend de retrouver les paiements non finalisés même
// après fermeture du navigateur ou changement d'appareil.
// ─────────────────────────────────────────────────────────────────
router.get("/swychr/pending", authenticate, async (req, res): Promise<void> => {
  const pendingTxs = await db
    .select()
    .from(swychrTransactionsTable)
    .where(and(
      eq(swychrTransactionsTable.userId, req.userId!),
      eq(swychrTransactionsTable.status, "pending"),
    ))
    .orderBy(desc(swychrTransactionsTable.createdAt))
    .limit(5);

  res.json({
    transactions: pendingTxs.map((t) => ({
      transactionId: t.paymentRef,
      paymentUrl: t.paymentUrl,
      amount: parseFloat(t.amount),
      purpose: t.purpose,
      createdAt: t.createdAt,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/swychr/status/:txId — Vérifier le statut du paiement
// ─────────────────────────────────────────────────────────────────
router.get("/swychr/status/:txId", authenticate, async (req, res): Promise<void> => {
  const txId = req.params.txId as string;

  const [tx] = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.paymentRef, txId));

  if (!tx || tx.userId !== req.userId!) {
    res.status(404).json({ success: false, error: "Transaction introuvable" });
    return;
  }

  if (tx.status === "SUCCESS") {
    res.json({ success: true, status: "success", isPaid: true, purpose: tx.purpose });
    return;
  }
  if (tx.status === "FAILED") {
    res.json({ success: true, status: "failed", isPaid: false, purpose: tx.purpose });
    return;
  }

  try {
    const { status } = await checkPaymentStatus(txId);

    if (status === "success" && tx.status !== "SUCCESS") {
      await handlePaymentSuccess(txId, "polling", req.log);
    } else if (status === "failed" && tx.status !== "FAILED") {
      await db
        .update(swychrTransactionsTable)
        .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(swychrTransactionsTable.paymentRef, txId));
    }

    const [refreshed] = await db
      .select()
      .from(swychrTransactionsTable)
      .where(eq(swychrTransactionsTable.paymentRef, txId));
    const localStatus = refreshed?.status ?? tx.status;

    if (localStatus === "SUCCESS") {
      res.json({ success: true, status: "success", isPaid: true, purpose: tx.purpose });
    } else if (localStatus === "FAILED") {
      res.json({ success: true, status: "failed", isPaid: false, purpose: tx.purpose });
    } else {
      res.json({ success: true, status: "pending", isPaid: false, purpose: tx.purpose });
    }
  } catch (err) {
    req.log.error({ err }, "[AccountPE] status check error");
    res.json({ success: true, status: "pending", isPaid: false, purpose: tx.purpose });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/accountpe/webhook  &  /api/webhook/swychr (alias)
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

    const { status } = await checkPaymentStatus(transactionId);
    req.log.info({ transactionId, status }, "[AccountPE] Statut vérifié après webhook");

    if (status === "success") {
      await handlePaymentSuccess(transactionId, "webhook", req.log);
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

export default router;
