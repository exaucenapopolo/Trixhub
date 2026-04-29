import { pgTable, text, serial, timestamp, integer, jsonb, date, decimal, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Aggrégat hebdomadaire des points gagnés par un user.
 * Une ligne par (user, weekStart). Permet conversion atomique le dimanche.
 *
 * status :
 *   - 'accumulating' : semaine en cours, en train de cumuler
 *   - 'converted' : conversion réussie (totalPoints == 700, fait dimanche)
 *   - 'expired' : semaine passée sans conversion (lazy update)
 *
 * dailyBreakdown : { "0": 50, "1": 100, ..., "6": 0 } — cap quotidien 100.
 */
export const weeklyPointsTable = pgTable(
  "weekly_points",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    weekStart: date("week_start").notNull(),
    totalPoints: integer("total_points").notNull().default(0),
    dailyBreakdown: jsonb("daily_breakdown").notNull().default({}),
    status: text("status").notNull().default("accumulating"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedAmount: decimal("converted_amount", { precision: 15, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("weekly_points_user_week_unique").on(t.userId, t.weekStart)],
);

export const insertWeeklyPointsSchema = createInsertSchema(weeklyPointsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertWeeklyPoints = z.infer<typeof insertWeeklyPointsSchema>;
export type WeeklyPoints = typeof weeklyPointsTable.$inferSelect;
