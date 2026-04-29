import { sql, eq, and, lt } from "drizzle-orm";
import {
  db,
  weeklyPointsTable,
  activityCompletionsTable,
  balancesTable,
  transactionsTable,
} from "@workspace/db";
import type { Logger } from "pino";

/**
 * Système de points hebdomadaire TRIXHUB.
 *
 * Règles métier :
 * - Semaine = lundi 00:00 → dimanche 23:59 en TZ Africa/Douala (UTC+1, pas de DST).
 * - Cap quotidien : 100 points/jour (anti-fraude : empêche de tout faire en 1 jour).
 * - Cap hebdomadaire : 700 points/semaine (= 7 jours × 100).
 * - Conversion : uniquement le dimanche, et uniquement si totalPoints == 700.
 * - 1 point = 1 FCFA → conversion crédite activity_balance de 700 FCFA pile.
 * - Si dimanche raté → semaine passe à 'expired' au prochain accès, points perdus.
 */

export const DAILY_POINT_CAP = 100;
export const WEEKLY_POINT_CAP = 700;
export const ACTIVITY_WITHDRAWAL_MIN = 3500; // FCFA

// Points par type d'activité
export const ACTIVITY_POINTS = {
  video: 20,
  quiz: 50, // max si 5/5 ; sinon 10 par bonne réponse
  discovery: 30,
  surprise: 100, // max ; ajusté par admin selon vues
} as const;

export type ActivityType = keyof typeof ACTIVITY_POINTS;

const CAMEROON_OFFSET_MS = 60 * 60 * 1000; // UTC+1 fixe

/**
 * Date du lundi de la semaine courante en TZ Africa/Douala, format YYYY-MM-DD.
 */
export function getCurrentWeekStart(now: Date = new Date()): string {
  const cameroon = new Date(now.getTime() + CAMEROON_OFFSET_MS);
  // getUTCDay : 0=dimanche, 1=lundi, ..., 6=samedi
  const utcDay = cameroon.getUTCDay();
  // Décalage à appliquer pour reculer jusqu'au lundi (lundi-relative).
  // Si dimanche (0) → on recule de 6 jours pour atteindre le lundi précédent.
  // Si lundi (1) → 0 jour. Mardi (2) → 1 jour. Etc.
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(cameroon.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  // Format YYYY-MM-DD basé sur la date Cameroon
  const yyyy = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Jour de la semaine en TZ Africa/Douala : 0=lundi, 6=dimanche.
 */
export function getDayOfWeek(now: Date = new Date()): number {
  const cameroon = new Date(now.getTime() + CAMEROON_OFFSET_MS);
  const utcDay = cameroon.getUTCDay(); // 0=dim..6=sam
  return utcDay === 0 ? 6 : utcDay - 1;
}

/**
 * Vrai si on est dimanche (en TZ Africa/Douala).
 */
export function isSunday(now: Date = new Date()): boolean {
  return getDayOfWeek(now) === 6;
}

export type AwardResult =
  | {
      success: true;
      awarded: number;
      newDailyTotal: number;
      newWeeklyTotal: number;
      dailyCapReached: boolean;
      weeklyCapReached: boolean;
      completionId: number;
    }
  | {
      success: false;
      reason: "daily_cap" | "weekly_cap" | "invalid_points";
      currentDailyTotal: number;
      currentWeeklyTotal: number;
    };

/**
 * Attribue des points pour une activité. Atomique via transaction + advisory lock.
 *
 * status='pending' (surprise admin) : crée la completion mais N'incrémente PAS le weekly.
 * Les points seront effectivement comptabilisés quand l'admin approuvera (via approveCompletion).
 */
export async function awardActivityPoints(params: {
  userId: number;
  activityType: ActivityType;
  points: number;
  activityId?: number | null;
  payloadProof?: Record<string, unknown> | null;
  status?: "approved" | "pending";
  log: Logger;
}): Promise<AwardResult> {
  const { userId, activityType, points, activityId = null, payloadProof = null, status = "approved", log } = params;

  if (!Number.isInteger(points) || points <= 0 || points > 100) {
    return { success: false, reason: "invalid_points", currentDailyTotal: 0, currentWeeklyTotal: 0 };
  }

  const weekStart = getCurrentWeekStart();
  const dayOfWeek = getDayOfWeek();

  return db.transaction(async (tx) => {
    // Advisory lock par user pour sérialiser les awards concurrents.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);

    // Récupère / crée la ligne weekly_points de la semaine courante.
    const [existing] = await tx
      .select()
      .from(weeklyPointsTable)
      .where(and(eq(weeklyPointsTable.userId, userId), eq(weeklyPointsTable.weekStart, weekStart)));

    let weeklyRow = existing;
    if (!weeklyRow) {
      const [created] = await tx
        .insert(weeklyPointsTable)
        .values({
          userId,
          weekStart,
          totalPoints: 0,
          dailyBreakdown: {},
          status: "accumulating",
        })
        .onConflictDoNothing()
        .returning();
      if (created) {
        weeklyRow = created;
      } else {
        // Race: lock relâché — re-select
        const [refetch] = await tx
          .select()
          .from(weeklyPointsTable)
          .where(and(eq(weeklyPointsTable.userId, userId), eq(weeklyPointsTable.weekStart, weekStart)));
        weeklyRow = refetch!;
      }
    }

    // Si déjà converti ou expired (ne devrait pas arriver semaine en cours, mais safe)
    if (weeklyRow.status !== "accumulating") {
      log.warn(
        { userId, weekStart, status: weeklyRow.status },
        "POINTS_AWARD_BLOCKED: weekly status is not accumulating",
      );
      return {
        success: false as const,
        reason: "weekly_cap" as const,
        currentDailyTotal: 0,
        currentWeeklyTotal: weeklyRow.totalPoints,
      };
    }

    const breakdown = (weeklyRow.dailyBreakdown ?? {}) as Record<string, number>;
    const currentDaily = breakdown[String(dayOfWeek)] ?? 0;
    const currentWeekly = weeklyRow.totalPoints;

    // Pour 'pending' (surprise) : on insère la completion mais on N'incrémente pas
    // les points encore. L'admin approuvera et appellera approvePendingCompletion.
    if (status === "pending") {
      const [completion] = await tx
        .insert(activityCompletionsTable)
        .values({
          userId,
          activityType,
          activityId,
          pointsAwarded: points,
          weekStart,
          dayOfWeek,
          payloadProof,
          status: "pending",
        })
        .returning();
      log.info(
        { userId, activityType, points, completionId: completion.id },
        "ACTIVITY_PENDING_AWAITING_ADMIN",
      );
      return {
        success: true as const,
        awarded: 0,
        newDailyTotal: currentDaily,
        newWeeklyTotal: currentWeekly,
        dailyCapReached: currentDaily >= DAILY_POINT_CAP,
        weeklyCapReached: currentWeekly >= WEEKLY_POINT_CAP,
        completionId: completion.id,
      };
    }

    // Vérifs des caps
    if (currentDaily + points > DAILY_POINT_CAP) {
      return {
        success: false as const,
        reason: "daily_cap" as const,
        currentDailyTotal: currentDaily,
        currentWeeklyTotal: currentWeekly,
      };
    }
    if (currentWeekly + points > WEEKLY_POINT_CAP) {
      return {
        success: false as const,
        reason: "weekly_cap" as const,
        currentDailyTotal: currentDaily,
        currentWeeklyTotal: currentWeekly,
      };
    }

    // Insert completion
    const [completion] = await tx
      .insert(activityCompletionsTable)
      .values({
        userId,
        activityType,
        activityId,
        pointsAwarded: points,
        weekStart,
        dayOfWeek,
        payloadProof,
        status: "approved",
      })
      .returning();

    // Update aggregat
    const newBreakdown = { ...breakdown, [String(dayOfWeek)]: currentDaily + points };
    const newTotal = currentWeekly + points;
    await tx
      .update(weeklyPointsTable)
      .set({ totalPoints: newTotal, dailyBreakdown: newBreakdown })
      .where(eq(weeklyPointsTable.id, weeklyRow.id));

    log.info(
      { userId, activityType, points, newTotal, dayOfWeek },
      "ACTIVITY_POINTS_AWARDED",
    );

    return {
      success: true as const,
      awarded: points,
      newDailyTotal: currentDaily + points,
      newWeeklyTotal: newTotal,
      dailyCapReached: currentDaily + points >= DAILY_POINT_CAP,
      weeklyCapReached: newTotal >= WEEKLY_POINT_CAP,
      completionId: completion.id,
    };
  });
}

/**
 * Marque les semaines passées non converties comme 'expired'. Lazy : appelé par /weekly-status.
 */
export async function expirePastUnconvertedWeeks(userId: number): Promise<void> {
  const currentWeek = getCurrentWeekStart();
  await db
    .update(weeklyPointsTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(weeklyPointsTable.userId, userId),
        lt(weeklyPointsTable.weekStart, currentWeek),
        eq(weeklyPointsTable.status, "accumulating"),
      ),
    );
}

export type ConvertResult =
  | {
      success: true;
      convertedAmount: number;
      newActivityBalance: number;
    }
  | {
      success: false;
      reason: "not_sunday" | "not_full_700" | "already_converted" | "no_week";
      currentTotal: number;
    };

/**
 * Conversion dimanche : 700 points → 700 FCFA dans activity_balance.
 * Atomique. Idempotente (vérifie status='accumulating' avant update).
 */
export async function convertWeeklyPointsToBalance(params: {
  userId: number;
  log: Logger;
}): Promise<ConvertResult> {
  const { userId, log } = params;

  if (!isSunday()) {
    return { success: false, reason: "not_sunday", currentTotal: 0 };
  }

  const weekStart = getCurrentWeekStart();

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);

    const [weeklyRow] = await tx
      .select()
      .from(weeklyPointsTable)
      .where(and(eq(weeklyPointsTable.userId, userId), eq(weeklyPointsTable.weekStart, weekStart)));

    if (!weeklyRow) {
      return { success: false as const, reason: "no_week" as const, currentTotal: 0 };
    }
    if (weeklyRow.status === "converted") {
      return { success: false as const, reason: "already_converted" as const, currentTotal: weeklyRow.totalPoints };
    }
    if (weeklyRow.totalPoints !== WEEKLY_POINT_CAP) {
      return { success: false as const, reason: "not_full_700" as const, currentTotal: weeklyRow.totalPoints };
    }

    const amount = WEEKLY_POINT_CAP; // 1 pt = 1 FCFA → 700

    // Mark converted
    await tx
      .update(weeklyPointsTable)
      .set({
        status: "converted",
        convertedAt: new Date(),
        convertedAmount: String(amount),
      })
      .where(eq(weeklyPointsTable.id, weeklyRow.id));

    // Crédit activity_balance
    const [updatedBalance] = await tx
      .update(balancesTable)
      .set({
        activityBalance: sql`${balancesTable.activityBalance} + ${amount}`,
      })
      .where(eq(balancesTable.userId, userId))
      .returning();

    if (!updatedBalance) {
      // Race / user sans balance : créer
      await tx.insert(balancesTable).values({
        userId,
        activityBalance: String(amount),
      });
    }

    // Log transaction
    await tx.insert(transactionsTable).values({
      userId,
      type: "activity_conversion",
      amount: String(amount),
      description: `Conversion ${WEEKLY_POINT_CAP} pts → ${amount} FCFA (semaine ${weekStart})`,
      status: "completed",
    });

    log.info(
      { userId, weekStart, amount },
      "WEEKLY_POINTS_CONVERTED",
    );

    const newBal = updatedBalance ? Number(updatedBalance.activityBalance) : amount;

    return {
      success: true as const,
      convertedAmount: amount,
      newActivityBalance: newBal,
    };
  });
}
