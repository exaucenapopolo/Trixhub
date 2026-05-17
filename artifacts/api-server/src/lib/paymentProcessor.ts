import { db, usersTable, swychrTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Logger } from "pino";
import { activateUserTx, creditDepositTx } from "./activation";
import { checkPaymentStatus } from "./swychr";
import {
  sendActivationConfirmEmail,
  sendCommissionEmail,
  sendDepositConfirmEmail,
} from "./email";

// ─────────────────────────────────────────────────────────────────
// Traitement post-paiement (atomique + idempotent) — switch sur le purpose
//
// Toute la séquence (marquage SUCCESS + effets métier) est encapsulée dans une
// SEULE transaction DB. Si un effet métier échoue, le SUCCESS est rollbacké et
// la tx reste en "pending" → retry possible (polling, webhook ré-émis, cron).
//
// L'UPDATE conditionnel `WHERE status = 'pending'` garantit l'idempotence :
// si deux workers (polling + webhook + cron) traitent le même paiement, un seul gagne.
// ─────────────────────────────────────────────────────────────────
export async function handlePaymentSuccess(
  transactionId: string,
  source: string,
  log: Logger,
): Promise<void> {
  let emailData: { purpose: string; userId: number; amount: number } | null = null;

  try {
    await db.transaction(async (tx) => {
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

      if (purpose === "activation" || purpose === "free_self_activation") {
        const ok = await activateUserTx(tx, targetUserId, amount, `swychr_${source}`, undefined, log);
        if (!ok) {
          log.warn({ targetUserId, transactionId }, "[AccountPE] race activation self-payée, refund vers solde dépôt");
          await creditDepositTx(tx, targetUserId, amount, `${source}_refund_already_active`, log);
        } else {
          emailData = { purpose: "activation", userId: targetUserId, amount };
        }
      } else if (purpose === "deposit") {
        await creditDepositTx(tx, swyTx.userId, amount, source, log);
        emailData = { purpose: "deposit", userId: swyTx.userId, amount };
      } else if (purpose === "child_activation") {
        const [child] = await tx.select().from(usersTable).where(eq(usersTable.id, targetUserId));
        if (!child || child.isActivated) {
          log.warn({ targetUserId, transactionId }, "[AccountPE] child déjà activé (pré-check), refund vers solde dépôt parent");
          await creditDepositTx(tx, swyTx.userId, amount, `${source}_refund`, log);
        } else {
          const ok = await activateUserTx(tx, targetUserId, amount, `swychr_${source}_by_parent`, swyTx.userId, log);
          if (!ok) {
            log.warn({ targetUserId, transactionId }, "[AccountPE] race child_activation, refund vers solde dépôt parent");
            await creditDepositTx(tx, swyTx.userId, amount, `${source}_refund_race`, log);
          } else {
            emailData = { purpose: "activation", userId: targetUserId, amount };
          }
        }
      } else {
        log.warn({ purpose, transactionId }, "[AccountPE] purpose inconnu");
        throw new Error(`Unknown purpose: ${purpose}`);
      }
    });
  } catch (err) {
    log.error({ err, transactionId }, "[AccountPE] handlePaymentSuccess rollbacké, tx restera en pending pour retry");
    return;
  }

  const ed = emailData as { purpose: string; userId: number; amount: number } | null;
  if (!ed) return;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ed.userId));
    if (!user) return;

    if (ed.purpose === "activation") {
      sendActivationConfirmEmail(user).catch((err) => log.warn({ err }, "Email activation échoué"));
      if (user.referredByCode) {
        const [ref1] = await db.select().from(usersTable).where(eq(usersTable.referralCode, user.referredByCode));
        if (ref1) {
          sendCommissionEmail(ref1, user, 1700, 1).catch((err) => log.warn({ err }, "Email commission N1 échoué"));
          if (ref1.referredByCode) {
            const [ref2] = await db.select().from(usersTable).where(eq(usersTable.referralCode, ref1.referredByCode));
            if (ref2) {
              sendCommissionEmail(ref2, user, 700, 2).catch((err) => log.warn({ err }, "Email commission N2 échoué"));
              if (ref2.referredByCode) {
                const [ref3] = await db.select().from(usersTable).where(eq(usersTable.referralCode, ref2.referredByCode));
                if (ref3) {
                  sendCommissionEmail(ref3, user, 200, 3).catch((err) => log.warn({ err }, "Email commission N3 échoué"));
                }
              }
            }
          }
        }
      }
    } else if (ed.purpose === "deposit") {
      sendDepositConfirmEmail(user, ed.amount).catch((err) => log.warn({ err }, "Email dépôt échoué"));
    }
  } catch (emailErr) {
    log.warn({ emailErr }, "Emails post-paiement échoués (non bloquant)");
  }
}

// ─────────────────────────────────────────────────────────────────
// Cron : vérifie toutes les transactions en attente (appelé toutes les 5 min)
// Cela garantit que les paiements réussis sont traités même si :
//   - le webhook AccountPE n'a pas été reçu
//   - l'utilisateur a fermé son navigateur avant que le polling se termine
// ─────────────────────────────────────────────────────────────────
export async function checkAllPendingTransactions(log: Logger): Promise<void> {
  const pending = await db
    .select()
    .from(swychrTransactionsTable)
    .where(eq(swychrTransactionsTable.status, "pending"))
    .limit(30);

  if (pending.length === 0) return;

  log.info({ count: pending.length }, "[cron] Vérification des transactions en attente");

  for (const t of pending) {
    try {
      const { status } = await checkPaymentStatus(t.paymentRef);

      if (status === "success") {
        log.info({ ref: t.paymentRef }, "[cron] paiement réussi détecté, traitement...");
        await handlePaymentSuccess(t.paymentRef, "cron", log);
      } else if (status === "failed" || status === "refunded") {
        await db
          .update(swychrTransactionsTable)
          .set({ status: "FAILED", failedAt: new Date(), updatedAt: new Date() })
          .where(and(
            eq(swychrTransactionsTable.paymentRef, t.paymentRef),
            eq(swychrTransactionsTable.status, "pending"),
          ));
        log.info({ ref: t.paymentRef }, "[cron] tx marquée FAILED");
      }
    } catch (e) {
      log.warn({ err: e, ref: t.paymentRef }, "[cron] erreur lors de la vérification de tx");
    }
  }
}
