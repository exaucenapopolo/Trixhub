import { sql, eq } from "drizzle-orm";
import { db, balancesTable, transactionsTable } from "@workspace/db";
import type { Logger } from "pino";

const DAILY_BONUS_AMOUNT = 5; // FCFA par jour de connexion

/**
 * Crédite le bonus quotidien de connexion (+5 FCFA) si pas déjà attribué aujourd'hui.
 *
 * Toutes les opérations sont enveloppées dans une transaction DB pour garantir
 * l'atomicité ACID : soit le stamp + crédit + log s'appliquent ensemble, soit rien.
 *
 * Le verrou anti-double-claim est l'UPDATE conditionnel sur la date :
 *   UPDATE users SET last_daily_bonus_at = NOW()
 *     WHERE id = ?
 *       AND (last_daily_bonus_at IS NULL OR last_daily_bonus_at::date < CURRENT_DATE)
 *   RETURNING id;
 *
 * Si 0 ligne → déjà attribué aujourd'hui, on rollback et retourne false.
 *
 * @returns true si le bonus a été crédité, false sinon.
 */
export async function claimDailyBonusIfDue(userId: number, log: Logger): Promise<boolean> {
  return db.transaction(async (tx) => {
    // 1. Verrou atomique sur la date du jour
    const stamped = await tx.execute(sql`
      UPDATE users
         SET last_daily_bonus_at = NOW()
       WHERE id = ${userId}
         AND (last_daily_bonus_at IS NULL OR last_daily_bonus_at::date < CURRENT_DATE)
      RETURNING id
    `);

    if (stamped.rows.length === 0) {
      return false; // déjà attribué aujourd'hui
    }

    // 2. Crédit atomique +5 FCFA au solde bonus (UPDATE arithmétique SQL)
    const credited = await tx
      .update(balancesTable)
      .set({ bonusBalance: sql`${balancesTable.bonusBalance} + ${DAILY_BONUS_AMOUNT}` })
      .where(eq(balancesTable.userId, userId))
      .returning();

    if (credited.length === 0) {
      // Pas de ligne balances pour cet user — on throw pour rollback du stamp
      log.error({ userId }, "[dailyBonus] balances introuvable — rollback");
      throw new Error("balances row missing");
    }

    // 3. Log de la transaction
    await tx.insert(transactionsTable).values({
      userId,
      type: "bonus_daily",
      amount: DAILY_BONUS_AMOUNT.toFixed(2),
      description: `Bonus de connexion quotidien (+${DAILY_BONUS_AMOUNT} FCFA)`,
      status: "completed",
    });

    log.info({ userId, amount: DAILY_BONUS_AMOUNT }, "[dailyBonus] ✅ bonus crédité");
    return true;
  }).catch((err) => {
    // Le throw "balances row missing" tombe ici — on log et retourne false sans crash
    if (err instanceof Error && err.message === "balances row missing") return false;
    throw err;
  });
}

export const DAILY_BONUS = DAILY_BONUS_AMOUNT;
