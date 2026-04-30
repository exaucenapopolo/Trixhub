import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, sql, and, gte, isNull } from "drizzle-orm";
import { db, usersTable, balancesTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { requireAdmin } from "../middlewares/requireAdmin";
import { withdrawalLimiter } from "../middlewares/rateLimiters";
import { RequestWithdrawalBody } from "@workspace/api-zod";
import { reportWithdrawalCreated, reportWithdrawalStatusChange, reportWithdrawalProof } from "../lib/withdrawalReports";
import { uploadProofImage, getPublicProofUrl } from "../lib/uploadProof";

const MIN_REFERRAL = 3000;
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
    source: w.source ?? "referral",
    status: w.status,
    rejectionReason: w.rejectionReason ?? null,
    proofUrl: w.proofUrl ?? null,
    proofUploadedAt: w.proofUploadedAt ? w.proofUploadedAt.toISOString() : null,
    requestedAt: w.createdAt.toISOString(),
    processedAt: w.processedAt ? w.processedAt.toISOString() : null,
  };
}

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

  const { amount, method, accountNumber, accountName, source } = parsed.data;
  const src = source === "task" ? "task" : "referral";
  const minAmount = src === "task" ? MIN_TASK : MIN_REFERRAL;

  if (amount < minAmount) {
    res.status(400).json({
      error: `Le montant minimum de retrait pour ce solde est de ${minAmount} FCFA`,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || !user.isActivated) {
    res.status(400).json({ error: "Votre compte doit être activé pour effectuer un retrait" });
    return;
  }

  const sourceColumn = src === "task" ? balancesTable.taskBalance : balancesTable.referralBalance;
  const userId = req.userId!;

  type TxResult =
    | { ok: true; withdrawal: typeof withdrawalsTable.$inferSelect }
    | { ok: false; available: number };

  const result = await db.transaction(async (tx): Promise<TxResult> => {
    const decrementSql = src === "task"
      ? { taskBalance: sql`(${balancesTable.taskBalance})::numeric - ${amount.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${amount.toFixed(2)}::numeric` }
      : { referralBalance: sql`(${balancesTable.referralBalance})::numeric - ${amount.toFixed(2)}::numeric`,
          withdrawnAmount: sql`(${balancesTable.withdrawnAmount})::numeric + ${amount.toFixed(2)}::numeric` };

    const updated = await tx.update(balancesTable)
      .set(decrementSql)
      .where(and(
        eq(balancesTable.userId, userId),
        gte(sql`(${sourceColumn})::numeric`, sql`${amount.toFixed(2)}::numeric`),
      ))
      .returning();

    if (updated.length === 0) {
      const [b] = await tx.select().from(balancesTable).where(eq(balancesTable.userId, userId));
      const available = b ? parseFloat(src === "task" ? b.taskBalance : b.referralBalance) : 0;
      return { ok: false, available };
    }

    const [withdrawal] = await tx.insert(withdrawalsTable).values({
      userId,
      amount: amount.toFixed(2),
      method,
      accountNumber,
      accountName,
      source: src,
      status: "pending",
    }).returning();

    await tx.insert(transactionsTable).values({
      userId,
      type: "withdrawal",
      amount: `-${amount.toFixed(2)}`,
      description: `Retrait ${src === "task" ? "missions" : "parrainage"} via ${method}`,
      status: "pending",
    });

    return { ok: true, withdrawal };
  });

  if (!result.ok) {
    res.status(400).json({
      error: `Solde ${src === "task" ? "missions" : "parrainage"} insuffisant`,
      available: result.available,
      source: src,
    });
    return;
  }

  req.log.info({ userId, amount, source: src }, "Withdrawal requested");

  // Rapport WhatsApp à l'assistance (best-effort, ne bloque pas la réponse).
  reportWithdrawalCreated(result.withdrawal, user).catch((err) => {
    req.log.warn({ err: err?.message ?? String(err) }, "Échec envoi rapport retrait Twilio");
  });

  res.status(201).json(formatWithdrawal(result.withdrawal));
});

// ─────────────────────────────────────────────────────────────────
// Upload de la preuve de paiement (capture d'écran SMS) par le membre.
// L'image est stockée dans Object Storage, le lien est envoyé à l'assistance.
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

      // ATOMIC : on n'écrit la preuve que si proof_url est encore NULL.
      // Empêche la race entre 2 uploads concurrents.
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

      // Récupérer les infos user complètes pour le rapport
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

// Machine d'état des retraits :
//   pending    → processing | completed | rejected
//   processing → completed | rejected
//   completed  → (terminal)
//   rejected   → (terminal)
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

  // Vérification de la machine d'état (empêche notamment rejected → completed sans débit).
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

  // Transition + rollback (si rejet) en une transaction atomique.
  // L'UPDATE des withdrawals est conditionné par le statut courant pour bloquer les races concurrentes.
  type TxOk = { ok: true; updated: typeof withdrawalsTable.$inferSelect };
  type TxFail = { ok: false; reason: "race" };
  const txResult = await db.transaction(async (tx): Promise<TxOk | TxFail> => {
    const updatedRows = await tx.update(withdrawalsTable)
      .set(update)
      .where(and(
        eq(withdrawalsTable.id, id),
        eq(withdrawalsTable.status, existing.status), // garde la transition atomique
      ))
      .returning();

    if (updatedRows.length === 0) {
      return { ok: false, reason: "race" };
    }

    // Rollback du solde si on bascule vers rejected.
    // (existing.status était != rejected, garanti par la machine d'état + UPDATE conditionnel.)
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
  }

  req.log.info({ withdrawalId: id, from: existing.status, to: status }, "Statut retrait modifié");
  res.json(formatWithdrawal(updated));
});

export default router;
