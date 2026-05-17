import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import type { Logger } from "pino";

const ACTIVATION_BONUS = 800;
const COMMISSIONS = { 1: 1700, 2: 700, 3: 200 } as const;

// Compte gratuit : seuil d'activation automatique et dette post-activation
const FREE_ACCOUNT_THRESHOLD = 3400; // FCFA requis pour l'auto-activation
const FREE_ACCOUNT_DEBT = 200;       // FCFA déduits de la prochaine commission

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * autoActivateFreeAccountTx — Active automatiquement un compte gratuit qui a
 * atteint le seuil de crédit (3 400 FCFA accumulés via commissions de parrainage).
 * ────────────────────────────────────────────────────────────────────────────
 * - Lève les restrictions (activities, formations, canva)
 * - Octroie le bonus de bienvenue (+800 FCFA)
 * - Transfère le surplus éventuel vers le solde parrainage
 * - Pose une dette de 200 FCFA sur la prochaine commission
 *
 * @returns true si activation effective, false si déjà activé.
 */
async function autoActivateFreeAccountTx(
  tx: Tx,
  userId: number,
  totalCredit: number,
  log: Logger,
): Promise<boolean> {
  const surplus = Math.max(0, totalCredit - FREE_ACCOUNT_THRESHOLD);

  const activated = await tx
    .update(usersTable)
    .set({
      isActivated: true,
      blockedActivities: false,
      blockedFormations: false,
      blockedCanva: false,
      freeAccountDebt: FREE_ACCOUNT_DEBT.toFixed(2),
    })
    .where(and(eq(usersTable.id, userId), eq(usersTable.isActivated, false)))
    .returning();

  if (activated.length === 0) {
    log.info({ userId }, "[free-activation] déjà activé, no-op");
    return false;
  }

  const balUpd = await tx
    .update(balancesTable)
    .set({
      bonusBalance: sql`${balancesTable.bonusBalance} + ${ACTIVATION_BONUS}`,
      referralBalance: sql`${balancesTable.referralBalance} + ${surplus}`,
    })
    .where(eq(balancesTable.userId, userId))
    .returning();
  if (balUpd.length === 0) throw new Error(`MISSING_BALANCE_ROW user=${userId}`);

  const logs: (typeof transactionsTable.$inferInsert)[] = [
    {
      userId,
      type: "activation_free",
      amount: "0.00",
      description: "Activation automatique via compte gratuit — crédit de parrainage atteint (3 400 FCFA)",
      status: "completed",
    },
    {
      userId,
      type: "bonus_activation",
      amount: ACTIVATION_BONUS.toFixed(2),
      description: `Bonus de bienvenue à l'activation (+${ACTIVATION_BONUS} FCFA)`,
      status: "completed",
    },
  ];
  if (surplus > 0) {
    logs.push({
      userId,
      type: "referral_free_surplus",
      amount: surplus.toFixed(2),
      description: `Excédent de crédit après activation automatique (+${surplus.toLocaleString("fr-FR")} FCFA)`,
      status: "completed",
    });
  }
  await tx.insert(transactionsTable).values(logs);

  log.info({ userId, totalCredit, surplus }, "[free-activation] ✅ compte gratuit auto-activé");
  return true;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * activateUserTx — version "in-transaction" idempotente (paiement normal).
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function activateUserTx(
  tx: Tx,
  userId: number,
  amount: number,
  source: string,
  paidBy: number | undefined,
  log: Logger,
): Promise<boolean> {
  const activated = await tx
    .update(usersTable)
    .set({
      isActivated: true,
      blockedActivities: false,
      blockedFormations: false,
      blockedCanva: false,
      freeAccountDebt: "0.00",
    })
    .where(and(eq(usersTable.id, userId), eq(usersTable.isActivated, false)))
    .returning();

  if (activated.length === 0) {
    log.info({ userId, source }, "[activation] déjà activé, no-op");
    return false;
  }

  const user = activated[0];

  const balUpdated = await tx
    .update(balancesTable)
    .set({
      bonusBalance: sql`${balancesTable.bonusBalance} + ${ACTIVATION_BONUS}`,
      spentAmount: sql`${balancesTable.spentAmount} + ${amount}`,
    })
    .where(eq(balancesTable.userId, userId))
    .returning();
  if (balUpdated.length === 0) {
    throw new Error(`MISSING_BALANCE_ROW user=${userId}`);
  }

  await tx.insert(transactionsTable).values([
    {
      userId,
      type: "activation",
      amount: `-${amount.toFixed(2)}`,
      description: `Activation compte TRIXHUB (${source})`,
      status: "completed",
    },
    {
      userId,
      type: "bonus_activation",
      amount: ACTIVATION_BONUS.toFixed(2),
      description: `Bonus de bienvenue à l'activation (+${ACTIVATION_BONUS} FCFA)`,
      status: "completed",
    },
  ]);

  log.info({ userId, source, paidBy }, "[activation] ✅ compte activé");

  if (user.referredByCode) {
    const ref1 = await creditCommissionTx(tx, user, COMMISSIONS[1], 1, user.referredByCode, log);
    if (ref1?.referredByCode) {
      const ref2 = await creditCommissionTx(tx, user, COMMISSIONS[2], 2, ref1.referredByCode, log);
      if (ref2?.referredByCode) {
        await creditCommissionTx(tx, user, COMMISSIONS[3], 3, ref2.referredByCode, log);
      }
    }
  }

  return true;
}

export async function activateUser(
  userId: number,
  amount: number,
  source: string,
  paidBy: number | undefined,
  log: Logger,
): Promise<boolean> {
  return db.transaction(async (tx) => activateUserTx(tx, userId, amount, source, paidBy, log));
}

/**
 * Crédite une commission à un parrain (N1/N2/N3) avec logique compte gratuit.
 *
 * — Si le bénéficiaire est un compte gratuit non encore activé :
 *     → commission → activationCredit (sur users)
 *     → inactiveBalance réduit (cohérence comptable)
 *     → auto-activation si activationCredit >= 3 400 FCFA
 *
 * — Si le bénéficiaire est activé avec une dette gratuit (200 FCFA) :
 *     → 200 FCFA déduits de la commission (récupération unique)
 *     → le reste → referralBalance
 *
 * — Cas normal : commission → referralBalance, inactiveBalance réduit.
 */
async function creditCommissionTx(
  tx: Tx,
  activatedUser: typeof usersTable.$inferSelect,
  commission: number,
  level: number,
  referrerCode: string,
  log: Logger,
): Promise<typeof usersTable.$inferSelect | null> {
  const [ref] = await tx.select().from(usersTable).where(eq(usersTable.referralCode, referrerCode));
  if (!ref) {
    log.warn({ referrerCode, level, activatedUserId: activatedUser.id }, "[activation] referrer introuvable, commission ignorée (dérive de données)");
    return null;
  }

  await tx.insert(balancesTable).values({ userId: ref.id }).onConflictDoNothing();

  const name = activatedUser.displayName || deriveDisplayName(activatedUser.email);

  // ── CAS COMPTE GRATUIT NON ENCORE ACTIVÉ ──────────────────────────────────
  if (ref.isFreeAccount && !ref.isActivated) {
    const newCredit = parseFloat(ref.activationCredit) + commission;

    await tx
      .update(usersTable)
      .set({ activationCredit: newCredit.toFixed(2) })
      .where(eq(usersTable.id, ref.id));

    await tx
      .update(balancesTable)
      .set({ inactiveBalance: sql`GREATEST(0, ${balancesTable.inactiveBalance} - ${commission})` })
      .where(eq(balancesTable.userId, ref.id));

    await tx.insert(transactionsTable).values({
      userId: ref.id,
      type: `referral_l${level}_free`,
      amount: commission.toFixed(2),
      description: `Crédit activation N${level} : ${name} a activé son compte (+${commission.toLocaleString("fr-FR")} FCFA → crédit d'activation)`,
      relatedUserId: activatedUser.id,
      level,
      status: "completed",
    });

    log.info({ refId: ref.id, commission, level, newCredit }, "[activation] commission → crédit compte gratuit");

    if (newCredit >= FREE_ACCOUNT_THRESHOLD) {
      await autoActivateFreeAccountTx(tx, ref.id, newCredit, log);
    }

    return ref;
  }

  // ── CAS NORMAL (activé, ou non-free inactif) ──────────────────────────────
  let creditAmount = commission;

  // Déduction unique de la dette post-activation gratuite (200 FCFA)
  if (ref.isActivated && parseFloat(ref.freeAccountDebt) > 0) {
    const debt = parseFloat(ref.freeAccountDebt);
    const deductible = Math.min(debt, commission);
    creditAmount = commission - deductible;
    const newDebt = Math.max(0, debt - deductible);

    await tx
      .update(usersTable)
      .set({ freeAccountDebt: newDebt.toFixed(2) })
      .where(eq(usersTable.id, ref.id));

    log.info({ refId: ref.id, deductible, newDebt, creditAmount }, "[activation] dette compte gratuit déduite");
  }

  const upd = await tx
    .update(balancesTable)
    .set({
      referralBalance: sql`${balancesTable.referralBalance} + ${creditAmount}`,
      inactiveBalance: sql`GREATEST(0, ${balancesTable.inactiveBalance} - ${commission})`,
    })
    .where(eq(balancesTable.userId, ref.id))
    .returning();
  if (upd.length === 0) {
    throw new Error(`MISSING_BALANCE_ROW_AFTER_UPSERT user=${ref.id}`);
  }

  await tx.insert(transactionsTable).values({
    userId: ref.id,
    type: `referral_l${level}`,
    amount: creditAmount.toFixed(2),
    description: `Commission N${level} : ${name} a activé son compte (+${creditAmount.toLocaleString("fr-FR")} FCFA)`,
    relatedUserId: activatedUser.id,
    level,
    status: "completed",
  });

  log.info({ refId: ref.id, commission, creditAmount, level }, "[activation] commission créditée");
  return ref;
}

/**
 * Crédit atomique du solde dépôt (utilisé après paiement Swychr réussi).
 */
export async function creditDepositTx(
  tx: Tx,
  userId: number,
  amount: number,
  source: string,
  log: Logger,
): Promise<void> {
  const upd = await tx
    .update(balancesTable)
    .set({ depositBalance: sql`${balancesTable.depositBalance} + ${amount}` })
    .where(eq(balancesTable.userId, userId))
    .returning();
  if (upd.length === 0) {
    throw new Error(`MISSING_BALANCE_ROW user=${userId}`);
  }

  await tx.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amount.toFixed(2),
    description: `Dépôt de ${amount.toLocaleString("fr-FR")} FCFA via AccountPE (${source})`,
    status: "completed",
  });

  log.info({ userId, amount, source }, "[deposit] ✅ solde dépôt crédité");
}

export const ACTIVATION_AMOUNT = 3600;
export const ACTIVATION_BONUS_AMOUNT = ACTIVATION_BONUS;
export const REFERRAL_PAYMENT_FEE = 500;
export const FREE_ACTIVATION_THRESHOLD = FREE_ACCOUNT_THRESHOLD;
