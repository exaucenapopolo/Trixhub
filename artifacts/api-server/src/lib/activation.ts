import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import type { Logger } from "pino";

const ACTIVATION_BONUS = 800; // FCFA crédités au solde bonus à l'activation
const COMMISSIONS = { 1: 1700, 2: 700, 3: 300 } as const;

// Type local pour les transactions Drizzle (db.transaction(async tx => ...))
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * activateUserTx — version "in-transaction" idempotente.
 * ────────────────────────────────────────────────────────────────────────────
 * Toutes les opérations passent par la transaction `tx` :
 *   1. UPDATE users SET is_activated = true WHERE id = ? AND is_activated = false RETURNING (verrou logique)
 *   2. Crédit +800 bonus + spent (UPDATE arithmétique SQL, pas de read-modify-write)
 *   3. Insert transactions activation + bonus
 *   4. Crédit commissions parents N1/N2/N3 (arithmétique SQL atomique)
 *
 * Si l'UPDATE conditionnel retourne 0 ligne → déjà activé → no-op (return false).
 *
 * @returns true si activation effective, false si déjà activé.
 */
export async function activateUserTx(
  tx: Tx,
  userId: number,
  amount: number,
  source: string,
  paidBy: number | undefined,
  log: Logger,
): Promise<boolean> {
  // 1. Activation atomique : 0 row si déjà activé → idempotent
  const activated = await tx
    .update(usersTable)
    .set({ isActivated: true })
    .where(and(eq(usersTable.id, userId), eq(usersTable.isActivated, false)))
    .returning();

  if (activated.length === 0) {
    log.info({ userId, source }, "[activation] déjà activé, no-op");
    return false;
  }

  const user = activated[0];

  // 2. Bonus de bienvenue +800 + spent — UPDATE arithmétique atomique.
  // STRICT : si la ligne balances est absente, throw → rollback total (pas d'activation
  // sans contrepartie comptable). Cela ne devrait jamais arriver (register crée la
  // balance), mais on protège contre la dérive de données.
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

  // 3. Transactions log
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

  // 4. Commissions parents N1 / N2 / N3 (chaîne ascendante)
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

/**
 * Wrapper public : ouvre sa propre transaction.
 */
export async function activateUser(
  userId: number,
  amount: number,
  source: string,
  paidBy: number | undefined,
  log: Logger,
): Promise<boolean> {
  return db.transaction(async (tx) => activateUserTx(tx, userId, amount, source, paidBy, log));
}

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
    // Dérive de données : referredByCode pointe vers un code inexistant.
    // On log explicitement pour observabilité (au lieu d'un skip silencieux).
    log.warn({ referrerCode, level, activatedUserId: activatedUser.id }, "[activation] referrer introuvable, commission ignorée (dérive de données)");
    return null;
  }

  // Garantit l'invariant "tout user a une balance" : upsert sûr (no-op si présente)
  // grâce à la contrainte UNIQUE sur balances.user_id. Les colonnes ont default "0".
  await tx.insert(balancesTable).values({ userId: ref.id }).onConflictDoNothing();

  // UPDATE atomique : référence_balance += commission, inactive_balance = GREATEST(0, - commission)
  const upd = await tx
    .update(balancesTable)
    .set({
      referralBalance: sql`${balancesTable.referralBalance} + ${commission}`,
      inactiveBalance: sql`GREATEST(0, ${balancesTable.inactiveBalance} - ${commission})`,
    })
    .where(eq(balancesTable.userId, ref.id))
    .returning();
  if (upd.length === 0) {
    // Ne devrait jamais arriver post-upsert : throw → rollback total.
    throw new Error(`MISSING_BALANCE_ROW_AFTER_UPSERT user=${ref.id}`);
  }

  const name = activatedUser.displayName || deriveDisplayName(activatedUser.email);
  await tx.insert(transactionsTable).values({
    userId: ref.id,
    type: `referral_l${level}`,
    amount: commission.toFixed(2),
    description: `Commission N${level}: ${name} a activé son compte (+${commission.toLocaleString("fr-FR")} FCFA)`,
    relatedUserId: activatedUser.id,
    level,
    status: "completed",
  });

  log.info({ refId: ref.id, commission, level }, "[activation] commission créditée");
  return ref;
}

/**
 * Crédit atomique du solde dépôt (utilisé après paiement Swychr réussi).
 * À appeler depuis une transaction.
 */
export async function creditDepositTx(
  tx: Tx,
  userId: number,
  amount: number,
  source: string,
  log: Logger,
): Promise<void> {
  // STRICT : si la balance est absente, throw → rollback complet de la tx parent.
  // Pas question de logger un dépôt "completed" sans crédit réel (perte financière).
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
export const REFERRAL_PAYMENT_FEE = 500; // frais quand on paie via solde parrainage
