import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
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
} from "../lib/swychr";
import { activateUserTx, creditDepositTx, ACTIVATION_AMOUNT } from "../lib/activation";

const router: IRouter = Router();

const MIN_DEPOSIT = 500;        // Montant minimum d'un dépôt libre
const MAX_DEPOSIT = 5_000_000;  // Anti-abus
const CHILD_ACTIVATION_AMOUNT = ACTIVATION_AMOUNT; // 3600

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/swychr/initiate
// Crée un lien de paiement AccountPE pour 3 cas d'usage :
//   purpose = "activation"        : activer son propre compte (3600)
//           = "deposit"           : recharger son solde dépôt (montant libre)
//           = "child_activation"  : activer un filleul N1 inactif (3600)
// ─────────────────────────────────────────────────────────────────
router.post("/swychr/initiate", authenticate, paymentLimiter, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(401).json({ success: false, error: "Utilisateur introuvable" }); return; }

  const body = req.body as {
    purpose?: "activation" | "deposit" | "child_activation";
    amount?: number;
    childId?: number;
    phoneNumber?: string;
  };
  const purpose = body.purpose ?? "activation";

  // ─── Validation par cas ───
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
    if (!user.isActivated) {
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
    if (!user.isActivated) {
      res.status(403).json({ success: false, error: "Activez votre compte d'abord" });
      return;
    }
    const childId = Number(body.childId);
    if (!Number.isFinite(childId) || childId <= 0) {
      res.status(400).json({ success: false, error: "ID filleul invalide" });
      return;
    }
    // Vérifier que le filleul existe, est bien N1 du parent, et est inactif
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
  } else {
    res.status(400).json({ success: false, error: "purpose invalide" });
    return;
  }

  // ─── Création du lien de paiement ───
  const transactionId = `TRIX-${Date.now()}-${user.id}`;
  const countryCode = COUNTRY_CODES[user.country] || "CM";
  const callbackUrl = getWebhookUrl();
  const mobile = (body.phoneNumber || user.phone).replace(/\D/g, "");
  const name = user.displayName || deriveDisplayName(user.email);

  req.log.info({ transactionId, purpose, amount, targetUserId }, "[AccountPE] initiate");

  try {
    const { paymentLink, id } = await createPaymentLink({
      countryCode,
      name,
      email: user.email,
      mobile,
      amount,
      currency: "XAF",
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

  // Vérifier en temps réel chez AccountPE, puis renvoyer la VÉRITÉ INTERNE (DB locale).
  // Si le provider dit "success" mais handlePaymentSuccess rollback (ex: balance manquante),
  // la tx locale reste "pending" → on doit refléter ce pending au front pour que le polling
  // continue, plutôt que de prétendre "success" sans crédit réel.
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

    // Recharger l'état local POST-traitement (source de vérité métier).
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

    // Toujours vérifier via l'API de statut
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

// ─────────────────────────────────────────────────────────────────
// Traitement post-paiement (atomique + idempotent) — switch sur le purpose
//
// Toute la séquence (marquage SUCCESS + effets métier) est encapsulée dans une
// SEULE transaction DB. Si un effet métier échoue, le SUCCESS est rollbacké et
// la tx reste en "pending" → retry possible (polling, webhook ré-émis).
//
// L'UPDATE conditionnel `WHERE status = 'pending'` garantit l'idempotence :
// si deux workers (polling + webhook) traitent le même paiement, un seul gagne.
// ─────────────────────────────────────────────────────────────────
async function handlePaymentSuccess(
  transactionId: string,
  source: string,
  log: import("pino").Logger,
) {
  try {
    await db.transaction(async (tx) => {
      // 1. Verrou logique : SUCCESS atomique uniquement si encore "pending"
      const updated = await tx
        .update(swychrTransactionsTable)
        .set({ status: "SUCCESS", completedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(swychrTransactionsTable.paymentRef, transactionId),
          eq(swychrTransactionsTable.status, "pending"),
        ))
        .returning();

      if (updated.length === 0) {
        log.info({ transactionId }, "[AccountPE] tx déjà traitée, no-op");
        return;
      }

      const swyTx = updated[0];
      const amount = parseFloat(swyTx.amount);
      const purpose = swyTx.purpose;
      const targetUserId = swyTx.targetUserId ?? swyTx.userId;

      // 2. Effets métier dans la même transaction
      if (purpose === "activation") {
        // Self-payée : si une race a activé l'utilisateur entre-temps (paiement précédent
        // déjà traité, activation par parent...), activateUserTx renvoie false. Pour
        // éviter un SUCCESS sans contrepartie, on rembourse vers le solde dépôt.
        const ok = await activateUserTx(tx, targetUserId, amount, `swychr_${source}`, undefined, log);
        if (!ok) {
          log.warn({ targetUserId, transactionId }, "[AccountPE] race activation self-payée, refund vers solde dépôt");
          await creditDepositTx(tx, targetUserId, amount, `${source}_refund_already_active`, log);
        }
      } else if (purpose === "deposit") {
        await creditDepositTx(tx, swyTx.userId, amount, source, log);
      } else if (purpose === "child_activation") {
        // Vérification rapide pour éviter la tentative inutile.
        const [child] = await tx.select().from(usersTable).where(eq(usersTable.id, targetUserId));
        if (!child || child.isActivated) {
          log.warn({ targetUserId, transactionId }, "[AccountPE] child déjà activé (pré-check), refund vers solde dépôt parent");
          await creditDepositTx(tx, swyTx.userId, amount, `${source}_refund`, log);
        } else {
          // activateUserTx fait un UPDATE conditionnel atomique. Si une race a
          // activé le child entre le SELECT ci-dessus et l'UPDATE → false ⇒ refund
          // dans la MÊME transaction (sinon SUCCESS sans effet ni remboursement).
          const ok = await activateUserTx(tx, targetUserId, amount, `swychr_${source}_by_parent`, swyTx.userId, log);
          if (!ok) {
            log.warn({ targetUserId, transactionId }, "[AccountPE] race child_activation, refund vers solde dépôt parent");
            await creditDepositTx(tx, swyTx.userId, amount, `${source}_refund_race`, log);
          }
        }
      } else {
        log.warn({ purpose, transactionId }, "[AccountPE] purpose inconnu");
        // On rollback en throw pour ne pas marquer la tx SUCCESS sans effet
        throw new Error(`Unknown purpose: ${purpose}`);
      }
    });
  } catch (err) {
    log.error({ err, transactionId }, "[AccountPE] handlePaymentSuccess rollbacké, tx restera en pending pour retry");
  }
}

export default router;
