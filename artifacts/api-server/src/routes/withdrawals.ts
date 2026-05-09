import { Router, type IRouter } from "express";
import { sendWithdrawalCreatedEmail, sendWithdrawalStatusEmail } from "../lib/email";
import multer from "multer";
import { eq, desc, sql, and, gte, isNull, isNotNull } from "drizzle-orm";
import { db, usersTable, balancesTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { requireAdmin } from "../middlewares/requireAdmin";
import { withdrawalLimiter } from "../middlewares/rateLimiters";
import { RequestWithdrawalBody } from "@workspace/api-zod";
import {
  reportWithdrawalCreated,
  reportWithdrawalStatusChange,
  reportWithdrawalProof,
  reportPayoutSuccess,
  reportPayoutFailed,
} from "../lib/withdrawalReports";
import { uploadProofImage, getPublicProofUrl } from "../lib/uploadProof";
import { getPublicBaseUrl } from "../lib/getPublicBaseUrl";
import {
  createPayout,
  getPayoutMethods,
  getPayoutFee,
  normalizeMobileForPayout,
  COUNTRY_CODES,
  COUNTRY_CURRENCIES,
  PAYOUT_MIN,
} from "../lib/swychr";
import { CURRENCY_RATES } from "../lib/currency";

const MIN_REFERRAL = PAYOUT_MIN; // 3100 FCFA — aligne avec AccountPE
const MIN_TASK = 3500;
const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 Mo

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) {
      cb(new Error("Format invalide : image PNG/JPG/WEBP uniquement"));
      return;
    }
    cb(null, true);
  },
});

function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  return {
    id: w.id,
    amount: parseFloat(w.amount),
    method: w.method,
    accountNumber: w.accountNumber,
    accountName: w.accountName,
    whatsappNumber: w.whatsappNumber ?? null,
    source: w.source ?? "referral",
    status: w.status,
    feeMode: w.feeMode ?? "from_amount",
    feeAmount: w.feeAmount ?? null,
    rejectionReason: w.rejectionReason ?? null,
    proofUrl: w.proofUrl ?? null,
    proofUploadedAt: w.proofUploadedAt ? w.proofUploadedAt.toISOString() : null,
    requestedAt: w.createdAt.toISOString(),
    processedAt: w.processedAt ? w.processedAt.toISOString() : null,
    payoutStatus: w.payoutStatus ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
// Route publique : preuves de retrait (galerie communautaire)
// ─────────────────────────────────────────────────────────────────
router.get("/withdrawals/proofs", async (req, res): Promise<void> => {
  const rows = await db.select({
    id: withdrawalsTable.id,
    amount: withdrawalsTable.amount,
    method: withdrawalsTable.method,
    proofToken: withdrawalsTable.proofToken,
    processedAt: withdrawalsTable.processedAt,
    displayName: usersTable.displayName,
    country: usersTable.country,
  })
    .from(withdrawalsTable)
    .innerJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(and(
      eq(withdrawalsTable.status, "completed"),
      isNotNull(withdrawalsTable.proofUrl),
      isNotNull(withdrawalsTable.proofToken),
    ))
    .orderBy(desc(withdrawalsTable.processedAt))
    .limit(60);

  const base = getPublicBaseUrl(req);
  res.json(rows.map((r) => {
    const parts = (r.displayName || "Membre").trim().split(/\s+/);
    const anonymized = parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
      : `${parts[0]}.`;
    return {
      id: r.id,
      amount: parseFloat(r.amount),
      method: r.method,
      userName: anonymized,
      country: r.country ?? null,
      proofImageUrl: `${base}/api/storage/proofs/${r.id}/${r.proofToken}`,
      processedAt: r.processedAt?.toISOString() ?? null,
    };
  }));
});

router.get("/withdrawals", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const withdrawals = await db.select().from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt));

  res.json(withdrawals.map(formatWithdrawal));
});

router.post("/withdrawals", authenticate, requireActivation, withdrawalLimiter, async (req, res): Promise<void> => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, method, accountNumber, accountName, source, whatsappNumber, payoutMethod, feeMode: rawFeeMode } = parsed.data;
  const src = source === "task" ? "task" : "referral";
  const minAmount = src === "task" ? MIN_TASK : MIN_REFERRAL;
  const feeMode: "from_amount" | "from_balance" = rawFeeMode === "from_balance" ? "from_balance" : "from_amount";

  if (amount < minAmount) {
    res.status(400).json({
      error: `Le montant minimum de retrait pour ce solde est de ${minAmount} FCFA`,
    });
    return;
  }

  // Champ WhatsApp obligatoire pour les retraits parrainage
  if (src === "referral" && (!whatsappNumber || whatsappNumber.trim().length < 8)) {
    res.status(400).json({ error: "Le numéro WhatsApp est obligatoire pour les retraits parrainage." });
    return;
  }

  // Méthode de paiement AccountPE obligatoire pour les retraits parrainage automatiques
  if (src === "referral" && (!payoutMethod || payoutMethod.trim().length === 0)) {
    res.status(400).json({ error: "La méthode de paiement est obligatoire." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || !user.isActivated) {
    res.status(400).json({ error: "Votre compte doit être activé pour effectuer un retrait" });
    return;
  }

  const fee = getPayoutFee(amount);

  // ─── Calcul du montant total à débiter du solde ───────────────────────────
  // from_amount : on débite `amount`, AccountPE reçoit `amount - fee`, l'utilisateur reçoit `amount - fee`
  // from_balance : on débite `amount + fee`, AccountPE reçoit `amount`, l'utilisateur reçoit `amount`
  const totalDebit = feeMode === "from_balance" ? amount + fee : amount;
  const amountSentToAccountPE = feeMode === "from_balance" ? amount : amount - fee;

  const sourceColumn = src === "task" ? balancesTable.taskBalance : balancesTable.referralBalance;
  const userId = req.userId!;

  type TxResult =
    | { ok: true; withdrawal: typeof withdrawalsTable.$inferSelect; balanceBefore: number; balanceAfter: number }
    | { ok: false; available: number; reason: string };

  const result = await db.transaction(async (tx): Promise<TxResult> => {
    // Lire le solde AVANT déduction pour le rapport WhatsApp
    const [balanceRow] = await tx.select().from(balancesTable).where(eq(balancesTable.userId, userId));
    const balanceBefore = balanceRow
      ? parseFloat(src === "task" ? balanceRow.taskBalance : balanceRow.referralBalance)
      : 0;

    const decrementSql = src === "task"
      ? { taskBalance: sql`(${balancesTable.taskBalance})::numeric - ${totalDebit.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${totalDebit.toFixed(2)}::numeric` }
      : { referralBalance: sql`(${balancesTable.referralBalance})::numeric - ${totalDebit.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${totalDebit.toFixed(2)}::numeric` };

    const updated = await tx.update(balancesTable)
      .set(decrementSql)
      .where(and(
        eq(balancesTable.userId, userId),
        gte(sql`(${sourceColumn})::numeric`, sql`${totalDebit.toFixed(2)}::numeric`),
      ))
      .returning();

    if (updated.length === 0) {
      const available = balanceBefore;
      const reason = feeMode === "from_balance"
        ? `Solde insuffisant pour couvrir le montant + les frais (${fee.toLocaleString("fr-FR")} FCFA). Il vous faut au moins ${totalDebit.toLocaleString("fr-FR")} FCFA.`
        : `Solde ${src === "task" ? "missions" : "parrainage"} insuffisant`;
      return { ok: false, available, reason };
    }

    const [withdrawal] = await tx.insert(withdrawalsTable).values({
      userId,
      amount: amount.toFixed(2),
      method,
      accountNumber,
      accountName,
      whatsappNumber: whatsappNumber ?? null,
      source: src,
      feeMode,
      feeAmount: fee,
      status: src === "referral" ? "processing" : "pending",
    }).returning();

    await tx.insert(transactionsTable).values({
      userId,
      type: "withdrawal",
      amount: `-${totalDebit.toFixed(2)}`,
      description: `Retrait ${src === "task" ? "missions" : "parrainage"} via ${method} (frais ${feeMode === "from_balance" ? "sur solde" : "déduits"} : ${fee.toLocaleString("fr-FR")} FCFA)`,
      status: "pending",
    });

    const balanceAfter = Math.max(0, balanceBefore - totalDebit);
    return { ok: true, withdrawal, balanceBefore, balanceAfter };
  });

  if (!result.ok) {
    res.status(400).json({
      error: result.reason,
      available: result.available,
      source: src,
    });
    return;
  }

  req.log.info({ userId, amount, totalDebit, fee, feeMode, source: src }, "Withdrawal requested");

  // Email confirmation (best-effort)
  sendWithdrawalCreatedEmail(user, result.withdrawal.amount, src, method ?? payoutMethod ?? "").catch((err) => {
    req.log.warn({ err }, "Email retrait créé échoué");
  });

  // ─── Payout SYNCHRONE AccountPE pour les retraits parrainage ────────────────
  // On attend la réponse d'AccountPE avant de notifier l'admin ou de répondre.
  // Cela garantit que le WhatsApp admin n'est envoyé qu'après confirmation du
  // partenaire, et que l'utilisateur est immédiatement informé en cas d'échec.
  if (src === "referral") {
    const w = result.withdrawal;
    const countryCode  = COUNTRY_CODES[user.country]      || "CM";
    const currency     = COUNTRY_CURRENCIES[user.country] || "XAF";
    // Convertir le montant FCFA → devise locale du portefeuille AccountPE du pays
    const fxRate             = CURRENCY_RATES[currency] ?? 1;
    const amountLocalCurrency = Math.round(amountSentToAccountPE * fxRate);

    const transactionId = `PAY-${Date.now()}-${userId}`;

    // Récupérer le mobileFormat depuis AccountPE (cache 30 min — rapide)
    // pour normaliser le numéro (ajout automatique de l'indicatif si requis)
    let mobileFormat: string | null = null;
    try {
      const methods = await getPayoutMethods(countryCode);
      const selectedPM = methods.find(m => m.id === payoutMethod);
      mobileFormat = selectedPM?.mobileFormat ?? null;
    } catch {
      // Si getPayoutMethods échoue → on envoie le numéro brut
    }
    const mobile = normalizeMobileForPayout(accountNumber, mobileFormat, countryCode);
    const name = user.displayName || accountName;

    req.log.info({ mobile, mobileFormat, countryCode }, "[AccountPE] Numéro normalisé");

    req.log.info(
      { transactionId, amount, fee, amountSentToAccountPE, amountLocalCurrency, currency, payoutMethod, countryCode },
      "[AccountPE] Payout initié",
    );

    try {
      const { id: payoutRef, status: payoutStatus } = await createPayout({
        countryCode,
        name,
        email: user.email,
        mobile,
        amountToSend: amountLocalCurrency,
        currency,
        transactionId,
        payoutMethod: payoutMethod!,
        description: `Retrait parrainage TRIXHUB — ${name} (frais ${fee.toLocaleString("fr-FR")} FCFA ${feeMode === "from_balance" ? "prélevés sur solde" : "déduits"})`,
      });

      req.log.info({ payoutRef, payoutStatus }, "[AccountPE] Payout accepté");

      // Mettre à jour le retrait avec la référence AccountPE
      const newStatus = payoutStatus === "success" ? "completed" : "processing";
      await db.update(withdrawalsTable)
        .set({
          payoutRef,
          payoutStatus,
          status: newStatus,
          processedAt: payoutStatus === "success" ? new Date() : undefined,
        })
        .where(eq(withdrawalsTable.id, w.id));

      // ✅ Notification WhatsApp admin — uniquement après confirmation AccountPE
      reportPayoutSuccess(w, user, payoutRef, payoutStatus as "pending" | "success", amountSentToAccountPE, fee, result.balanceBefore, result.balanceAfter).catch((err) => {
        req.log.warn({ err: err?.message ?? String(err) }, "Échec envoi WhatsApp succès payout");
      });

      res.status(201).json(formatWithdrawal({ ...w, payoutRef, payoutStatus, status: newStatus }));
      return;

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      req.log.error({ errMsg, withdrawalId: w.id }, "[AccountPE] Payout échoué — remboursement en cours");

      // Détecter si c'est un problème de solde dans le portefeuille AccountPE
      // Note : AccountPE écrit "Insuffiecient" (faute dans leur API)
      const isInsufficientFunds = /insuffi[sc]ient|solde|balance|funds|fonds|wallet|manque/i.test(errMsg);

      // ♻️ Rembourser automatiquement le solde de l'utilisateur
      await db.transaction(async (tx) => {
        await tx.update(balancesTable).set({
          referralBalance: sql`(${balancesTable.referralBalance})::numeric + ${totalDebit.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric - ${totalDebit.toFixed(2)}::numeric`,
        }).where(eq(balancesTable.userId, userId));

        await tx.update(withdrawalsTable).set({
          payoutStatus: "failed",
          status: "rejected",
          rejectionReason: isInsufficientFunds
            ? "Solde opérateur insuffisant — contactez l'assistance"
            : "Erreur technique lors du paiement — contactez l'assistance",
          processedAt: new Date(),
        }).where(eq(withdrawalsTable.id, w.id));
      }).catch((dbErr: unknown) => {
        req.log.error({ dbErr }, "[AccountPE] Remboursement solde échoué — intervention manuelle requise");
      });

      // 🚨 Notification WhatsApp admin avec la raison exacte de l'échec
      // Le solde est remboursé → balanceAfter = balanceBefore (solde inchangé après remboursement)
      reportPayoutFailed(w, user, errMsg, isInsufficientFunds, amount, totalDebit, amountSentToAccountPE, fee, result.balanceBefore, result.balanceBefore).catch((notifErr) => {
        req.log.warn({ err: notifErr }, "Échec envoi WhatsApp échec payout");
      });

      // Informer l'utilisateur selon la nature de l'échec
      const userMessage = isInsufficientFunds
        ? "Paiement temporairement indisponible : portefeuille opérateur insuffisant. Votre solde a été restitué. Contactez l'assistance pour être traité en priorité."
        : "Une erreur est survenue lors du paiement. Votre solde a été restitué automatiquement. Contactez l'assistance si le problème persiste.";

      res.status(503).json({
        error: userMessage,
        code: isInsufficientFunds ? "OPERATOR_INSUFFICIENT_FUNDS" : "PAYOUT_FAILED",
      });
      return;
    }
  }

  // Retraits missions : flux manuel existant
  reportWithdrawalCreated(result.withdrawal, user, result.balanceBefore, result.balanceAfter).catch((err) => {
    req.log.warn({ err: err?.message ?? String(err) }, "Échec envoi rapport retrait Twilio");
  });

  res.status(201).json(formatWithdrawal(result.withdrawal));
});

// ─────────────────────────────────────────────────────────────────
// Upload de la preuve de paiement (capture d'écran SMS) par le membre.
// ─────────────────────────────────────────────────────────────────
router.post(
  "/withdrawals/:id/proof",
  authenticate,
  requireActivation,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Upload échoué";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res): Promise<void> => {
    const userId = req.userId!;
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID retrait invalide" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Fichier manquant" });
      return;
    }

    const [w] = await db.select().from(withdrawalsTable).where(and(
      eq(withdrawalsTable.id, id),
      eq(withdrawalsTable.userId, userId),
    ));
    if (!w) {
      res.status(404).json({ error: "Retrait introuvable" });
      return;
    }
    if (w.proofUrl) {
      res.status(409).json({ error: "Une preuve a déjà été envoyée pour ce retrait" });
      return;
    }

    try {
      const { objectPath, token } = await uploadProofImage({
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
        withdrawalId: id,
        userId,
      });

      const updatedRows = await db.update(withdrawalsTable)
        .set({ proofUrl: objectPath, proofToken: token, proofUploadedAt: new Date() })
        .where(and(
          eq(withdrawalsTable.id, id),
          eq(withdrawalsTable.userId, userId),
          isNull(withdrawalsTable.proofUrl),
        ))
        .returning();

      if (updatedRows.length === 0) {
        res.status(409).json({ error: "Une preuve a déjà été envoyée pour ce retrait" });
        return;
      }
      const updated = updatedRows[0];
      const publicUrl = getPublicProofUrl(req, id, token);

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (user) {
        reportWithdrawalProof(updated, user, publicUrl).catch((err) => {
          req.log.warn({ err: err?.message ?? String(err) }, "Échec envoi preuve retrait Twilio");
        });
      }

      req.log.info({ withdrawalId: id, userId }, "Proof uploaded");
      res.status(201).json(formatWithdrawal(updated));
    } catch (err: any) {
      req.log.error({ err: err?.message ?? String(err) }, "Échec upload preuve");
      res.status(500).json({ error: "Échec de l'enregistrement de la preuve" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────
// Routes admin : changer le statut d'un retrait + lister tous les retraits.
// ─────────────────────────────────────────────────────────────────
router.get("/admin/withdrawals", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const items = await db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt)).limit(200);
  res.json(items.map(formatWithdrawal));
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "completed", "rejected"],
  processing: ["completed", "rejected"],
  completed: [],
  rejected: [],
};

router.patch("/admin/withdrawals/:id/status", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }
  const { status, reason } = req.body as { status?: string; reason?: string };
  const allowed = ["pending", "processing", "completed", "rejected"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ error: `Statut invalide (${allowed.join(", ")})` });
    return;
  }

  const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Retrait introuvable" });
    return;
  }
  if (existing.status === status) {
    res.json(formatWithdrawal(existing));
    return;
  }

  const validTargets = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!validTargets.includes(status)) {
    res.status(409).json({
      error: `Transition interdite : ${existing.status} → ${status}`,
      allowed: validTargets,
    });
    return;
  }

  const update: Partial<typeof withdrawalsTable.$inferInsert> = { status };
  if (status === "completed" || status === "rejected") {
    update.processedAt = new Date();
  }
  if (typeof reason === "string" && reason.trim()) {
    update.rejectionReason = reason.trim().slice(0, 500);
  }

  type TxOk = { ok: true; updated: typeof withdrawalsTable.$inferSelect };
  type TxFail = { ok: false; reason: "race" };
  const txResult = await db.transaction(async (tx): Promise<TxOk | TxFail> => {
    const updatedRows = await tx.update(withdrawalsTable)
      .set(update)
      .where(and(
        eq(withdrawalsTable.id, id),
        eq(withdrawalsTable.status, existing.status),
      ))
      .returning();

    if (updatedRows.length === 0) {
      return { ok: false, reason: "race" };
    }

    if (status === "rejected") {
      const isTask = existing.source === "task";
      const sourceCol = isTask ? balancesTable.taskBalance : balancesTable.referralBalance;
      await tx.update(balancesTable).set(isTask ? {
        taskBalance: sql`(${sourceCol})::numeric + ${existing.amount}::numeric`,
        withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric - ${existing.amount}::numeric`,
      } : {
        referralBalance: sql`(${sourceCol})::numeric + ${existing.amount}::numeric`,
        withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric - ${existing.amount}::numeric`,
      }).where(eq(balancesTable.userId, existing.userId));
    }

    return { ok: true, updated: updatedRows[0] };
  });

  if (!txResult.ok) {
    res.status(409).json({ error: "Le statut a été modifié par une autre opération. Rechargez la page." });
    return;
  }

  const updated = txResult.updated;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId));
  if (user) {
    reportWithdrawalStatusChange(updated, user, existing.status, update.rejectionReason).catch((err) => {
      req.log.warn({ err: err?.message ?? String(err) }, "Échec envoi changement statut Twilio");
    });
    sendWithdrawalStatusEmail(user, updated.amount, updated.status, updated.rejectionReason).catch((err) => {
      req.log.warn({ err }, "Email statut retrait échoué");
    });
  }

  req.log.info({ withdrawalId: id, from: existing.status, to: status }, "Statut retrait modifié");
  res.json(formatWithdrawal(updated));
});

export default router;
