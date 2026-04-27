import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, balancesTable, transactionsTable, swychrTransactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { callSwychrAPI, verifySwychrWebhookSignature, getWebhookUrl, SWYCHR_CONFIG } from "../lib/swychr";

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

  let swychrResult: Record<string, unknown>;
  try {
    swychrResult = await callSwychrAPI("/payments/initiate", "POST", {
      amount,
      currency,
      phone: phoneNumber,
      payment_method: paymentMethod,
      reference: paymentRef,
      description: "Activation compte TRIXHUB",
      callback_url: callbackUrl,
    });
    req.log.info({ swychrResult, paymentRef }, "Swychr initiation response");
  } catch (err) {
    req.log.error({ err }, "Swychr API error");
    res.status(502).json({ success: false, error: "Erreur de communication avec Swychr" });
    return;
  }

  if (swychrResult.error || swychrResult.status === "error") {
    res.status(400).json({
      success: false,
      error: (swychrResult.message as string) || (swychrResult.error as string) || "Échec initiation Swychr",
    });
    return;
  }

  const swychrRef = (swychrResult.transaction_id || swychrResult.id || swychrResult.ref || swychrResult.reference) as string | undefined;
  const paymentUrl = (swychrResult.payment_url || swychrResult.redirect_url || swychrResult.checkout_url) as string | undefined;
  const ussdCode = (swychrResult.ussd_code || swychrResult.ussd) as string | undefined;

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
    message: (swychrResult.message as string) || "Paiement initié. Suivez les instructions sur votre téléphone.",
  });
});

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
    statusResult = await callSwychrAPI(`/payments/${tx.swychrRef}`, "GET");
    req.log.info({ statusResult, ref }, "Swychr status check");
  } catch (err) {
    req.log.error({ err }, "Swychr status check error");
    res.json({ success: true, status: tx.status, activated: false });
    return;
  }

  const remoteStatus = (statusResult.status || "") as string;
  const isPaid = ["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED"].includes(remoteStatus.toUpperCase());
  const isFailed = ["FAILED", "CANCELLED", "EXPIRED"].includes(remoteStatus.toUpperCase());

  if (isPaid && tx.status !== "SUCCESS") {
    await handlePaymentSuccess(tx.paymentRef, tx.userId, parseFloat(tx.amount), tx.purpose);
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

async function handlePaymentSuccess(paymentRef: string, userId: number, amount: number, purpose: string) {
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
      await db.update(balancesTable)
        .set({ spentAmount: spent.toFixed(2) })
        .where(eq(balancesTable.userId, userId));
    }

    await db.insert(transactionsTable).values({
      userId,
      type: "activation",
      amount: `-${amount.toFixed(2)}`,
      description: "Activation du compte TRIXHUB (via Swychr)",
      status: "completed",
    });

    if (user.referredByCode) {
      await activateReferrerCommission(user, 1700, 1, user.referredByCode);
      const [ref1] = await db.select().from(usersTable).where(eq(usersTable.referralCode, user.referredByCode));
      if (ref1?.referredByCode) {
        await activateReferrerCommission(user, 700, 2, ref1.referredByCode);
        const [ref2] = await db.select().from(usersTable).where(eq(usersTable.referralCode, ref1.referredByCode));
        if (ref2?.referredByCode) {
          await activateReferrerCommission(user, 300, 3, ref2.referredByCode);
        }
      }
    }
  }
}

async function activateReferrerCommission(
  activatedUser: typeof usersTable.$inferSelect,
  commission: number,
  level: number,
  referrerCode: string
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

  await db.insert(transactionsTable).values({
    userId: ref.id,
    type: `referral_l${level}`,
    amount: commission.toFixed(2),
    description: `Commission N${level}: ${activatedUser.displayName || deriveDisplayName(activatedUser.email)} a activé son compte (+${commission.toLocaleString("fr-FR")} FCFA)`,
    relatedUserId: activatedUser.id,
    level,
    status: "completed",
  });
}

router.post(
  "/webhook/swychr",
  (req, _res, next) => {
    let raw = Buffer.alloc(0);
    req.on("data", (chunk: Buffer) => { raw = Buffer.concat([raw, chunk]); });
    req.on("end", () => {
      (req as unknown as Record<string, unknown>)._rawBody = raw;
      next();
    });
  },
  async (req, res): Promise<void> => {
    res.status(200).json({ received: true });

    try {
      const rawBody = (req as unknown as Record<string, unknown>)._rawBody as Buffer;
      const signature = (req.headers["x-swychr-signature"] || req.headers["x-signature"] || "") as string;

      if (SWYCHR_CONFIG.webhookSecret && signature) {
        if (!verifySwychrWebhookSignature(rawBody, signature)) {
          req.log.error("Invalid Swychr webhook signature");
          return;
        }
      }

      const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
      req.log.info({ payload }, "Swychr webhook received");

      const status = ((payload.status || "") as string).toUpperCase();
      const paymentRef = (payload.reference || payload.merchant_reference || payload.ref) as string | undefined;
      const amountPaid = parseFloat((payload.amount as string) || "0");

      if (!paymentRef) return;

      const isPaid = ["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED"].includes(status);
      const isFailed = ["FAILED", "CANCELLED", "EXPIRED"].includes(status);

      if (isPaid) {
        const [tx] = await db.select().from(swychrTransactionsTable).where(eq(swychrTransactionsTable.paymentRef, paymentRef));
        if (tx) {
          await handlePaymentSuccess(paymentRef, tx.userId, amountPaid || parseFloat(tx.amount), tx.purpose);
        }
      } else if (isFailed) {
        await db
          .update(swychrTransactionsTable)
          .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
          .where(eq(swychrTransactionsTable.paymentRef, paymentRef));
      }
    } catch (err) {
      req.log.error({ err }, "Webhook Swychr error");
    }
  }
);

export default router;
