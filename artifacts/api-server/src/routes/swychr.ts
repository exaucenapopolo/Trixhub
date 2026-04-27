import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, balancesTable, transactionsTable, swychrTransactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { callAccountPeAPI, verifyWebhookSignature, getWebhookUrl, SWYCHR_CONFIG } from "../lib/swychr";

const router: IRouter = Router();

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
// POST /api/swychr/initiate — Initier un paiement AccountPE
// ─────────────────────────────────────────────────────────────────
router.post("/swychr/initiate", authenticate, async (req, res): Promise<void> => {
  const { phoneNumber, paymentMethod, purpose } = req.body as {
    phoneNumber?: string;
    paymentMethod?: string;
    purpose?: string;
  };

  if (!phoneNumber || !paymentMethod) {
    res.status(400).json({ success: false, error: "Numéro de téléphone et mode de paiement requis" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ success: false, error: "Utilisateur introuvable" });
    return;
  }

  if (user.isActivated && purpose !== "topup") {
    res.status(400).json({ success: false, error: "Compte déjà activé" });
    return;
  }

  const paymentRef = `TRIX-${Date.now()}-${user.id}`;
  const amount = 3600;
  const currency = "XAF";
  const callbackUrl = getWebhookUrl();

  req.log.info({ callbackUrl, paymentRef }, "[AccountPE] Initiating payment");

  let result: Record<string, unknown>;
  try {
    result = await callAccountPeAPI("/payments/initiate", "POST", {
      amount,
      currency,
      phone: phoneNumber,
      payment_method: paymentMethod,
      reference: paymentRef,
      description: "Activation compte TRIXHUB",
      callback_url: callbackUrl,
    });
  } catch (err) {
    req.log.error({ err }, "[AccountPE] initiation error");
    res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : "Erreur de communication avec AccountPE",
    });
    return;
  }

  if (result.error || result.status === "error") {
    res.status(400).json({
      success: false,
      error: (result.message as string) || (result.error as string) || "Échec initiation AccountPE",
    });
    return;
  }

  const swychrRef = (
    result.transaction_id || result.id || result.ref || result.reference || result.transactionId
  ) as string | undefined;

  const paymentUrl = (
    result.payment_url || result.redirect_url || result.checkout_url || result.paymentUrl
  ) as string | undefined;

  const ussdCode = (result.ussd_code || result.ussd) as string | undefined;

  await db.insert(swychrTransactionsTable).values({
    userId: user.id,
    paymentRef,
    swychrRef: swychrRef ?? null,
    amount: amount.toFixed(2),
    currency,
    phoneNumber,
    paymentMethod,
    status: "pending",
    purpose: purpose || "activation",
    paymentUrl: paymentUrl ?? null,
    ussdCode: ussdCode ?? null,
  });

  res.json({
    success: true,
    reference: paymentRef,
    paymentUrl: paymentUrl ?? null,
    ussdCode: ussdCode ?? null,
    message: (result.message as string) || "Paiement initié. Suivez les instructions sur votre téléphone.",
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/swychr/status/:ref — Vérifier le statut d'un paiement
// ─────────────────────────────────────────────────────────────────
router.get("/swychr/status/:ref", authenticate, async (req, res): Promise<void> => {
  const { ref } = req.params;

  const [tx] = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.paymentRef, ref));

  if (!tx || tx.userId !== req.userId!) {
    res.status(404).json({ success: false, error: "Transaction introuvable" });
    return;
  }

  if (tx.status === "SUCCESS") {
    res.json({ success: true, status: "SUCCESS", activated: true });
    return;
  }

  if (tx.status === "FAILED") {
    res.json({ success: false, status: "FAILED", activated: false });
    return;
  }

  if (!tx.swychrRef) {
    res.json({ success: true, status: "pending", activated: false });
    return;
  }

  let statusResult: Record<string, unknown>;
  try {
    statusResult = await callAccountPeAPI(`/payments/${tx.swychrRef}`, "GET");
  } catch (err) {
    req.log.error({ err }, "[AccountPE] status check error");
    res.json({ success: true, status: tx.status, activated: false });
    return;
  }

  const remoteStatus = ((statusResult.status || statusResult.payment_status || "") as string).toUpperCase();
  const isPaid = ["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED", "APPROVED"].includes(remoteStatus);
  const isFailed = ["FAILED", "CANCELLED", "EXPIRED", "REJECTED"].includes(remoteStatus);

  if (isPaid && tx.status !== "SUCCESS") {
    await handlePaymentSuccess(tx.paymentRef, tx.userId, parseFloat(tx.amount), tx.purpose, req.log);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId));
    res.json({ success: true, status: "SUCCESS", activated: user?.isActivated ?? false });
    return;
  }

  if (isFailed && tx.status !== "FAILED") {
    await db
      .update(swychrTransactionsTable)
      .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
      .where(eq(swychrTransactionsTable.paymentRef, tx.paymentRef));
  }

  res.json({ success: true, status: isFailed ? "FAILED" : "pending", activated: false });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/accountpe/webhook — Webhook AccountPE (URL publique)
// POST /api/webhook/swychr   — Alias de compatibilité
// ─────────────────────────────────────────────────────────────────
async function handleWebhook(req: import("express").Request, res: import("express").Response): Promise<void> {
  res.status(200).json({ received: true });

  try {
    const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    const signature = (
      req.headers["x-accountpe-signature"] ||
      req.headers["x-swychr-signature"] ||
      req.headers["x-signature"] ||
      ""
    ) as string;

    if (SWYCHR_CONFIG.webhookSecret && signature) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        req.log.error("[AccountPE] Signature webhook invalide");
        return;
      }
    }

    const payload = req.body as Record<string, unknown>;
    if (!payload || typeof payload !== "object") {
      req.log.error("[AccountPE] Webhook payload invalide");
      return;
    }

    req.log.info({ payload }, "[AccountPE] Webhook reçu");

    const status = ((payload.status || payload.payment_status || "") as string).toUpperCase();
    const paymentRef = (
      payload.reference || payload.merchant_reference || payload.ref || payload.payment_reference
    ) as string | undefined;
    const amountPaid = parseFloat((payload.amount as string) || "0");

    if (!paymentRef) {
      req.log.warn("[AccountPE] Webhook sans reference de paiement");
      return;
    }

    const isPaid = ["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED", "APPROVED"].includes(status);
    const isFailed = ["FAILED", "CANCELLED", "EXPIRED", "REJECTED"].includes(status);

    if (isPaid) {
      const [tx] = await db
        .select()
        .from(swychrTransactionsTable)
        .where(eq(swychrTransactionsTable.paymentRef, paymentRef));
      if (tx) {
        await handlePaymentSuccess(
          paymentRef,
          tx.userId,
          amountPaid || parseFloat(tx.amount),
          tx.purpose,
          req.log
        );
      }
    } else if (isFailed) {
      await db
        .update(swychrTransactionsTable)
        .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(swychrTransactionsTable.paymentRef, paymentRef));
    }
  } catch (err) {
    req.log.error({ err }, "[AccountPE] Webhook error");
  }
}

// Route principale : /api/accountpe/webhook  (URL dans le tableau de bord AccountPE)
router.post("/accountpe/webhook", handleWebhook);

// Alias de compatibilité : /api/webhook/swychr
router.post("/webhook/swychr", handleWebhook);

// ─────────────────────────────────────────────────────────────────
// Logique interne : activation du compte après paiement confirmé
// ─────────────────────────────────────────────────────────────────
async function handlePaymentSuccess(
  paymentRef: string,
  userId: number,
  amount: number,
  purpose: string,
  log: import("pino").Logger
) {
  const [existing] = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.paymentRef, paymentRef));

  if (!existing || existing.status === "SUCCESS") return;

  await db
    .update(swychrTransactionsTable)
    .set({ status: "SUCCESS", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(swychrTransactionsTable.paymentRef, paymentRef));

  if (purpose === "activation") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.isActivated) return;

    await db.update(usersTable).set({ isActivated: true }).where(eq(usersTable.id, userId));

    const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));
    if (balance) {
      const spent = parseFloat(balance.spentAmount ?? "0") + amount;
      await db
        .update(balancesTable)
        .set({ spentAmount: spent.toFixed(2) })
        .where(eq(balancesTable.userId, userId));
    }

    await db.insert(transactionsTable).values({
      userId,
      type: "activation",
      amount: `-${amount.toFixed(2)}`,
      description: "Activation du compte TRIXHUB (via AccountPE / Swychr Connect)",
      status: "completed",
    });

    log.info({ userId, paymentRef }, "[AccountPE] Compte activé ✅");

    // Déclencher les commissions parrain
    if (user.referredByCode) {
      await activateReferrerCommission(user, 1700, 1, user.referredByCode, log);
      const [ref1] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.referralCode, user.referredByCode));
      if (ref1?.referredByCode) {
        await activateReferrerCommission(user, 700, 2, ref1.referredByCode, log);
        const [ref2] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.referralCode, ref1.referredByCode));
        if (ref2?.referredByCode) {
          await activateReferrerCommission(user, 300, 3, ref2.referredByCode, log);
        }
      }
    }
  }
}

async function activateReferrerCommission(
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

  await db
    .update(balancesTable)
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

  log.info({ referrerId: ref.id, commission, level }, "[AccountPE] Commission parrain créditée ✅");
}

export default router;
