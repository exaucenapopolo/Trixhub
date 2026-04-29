import { pgTable, text, serial, timestamp, integer, jsonb, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Trace de chaque complétion d'activité par un user.
 * weekStart = date du lundi (TZ Africa/Douala) — sert pour agréger les points hebdo.
 * dayOfWeek : 0=lundi, 6=dimanche.
 * status : 'approved' (auto) | 'pending' (surprise en attente admin) | 'rejected'.
 */
export const activityCompletionsTable = pgTable(
  "activity_completions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    activityType: text("activity_type").notNull(), // 'video' | 'quiz' | 'discovery' | 'surprise'
    activityId: integer("activity_id"), // null pour quiz généré IA
    pointsAwarded: integer("points_awarded").notNull(),
    weekStart: date("week_start").notNull(), // YYYY-MM-DD lundi Africa/Douala
    dayOfWeek: integer("day_of_week").notNull(), // 0..6 (0=lundi)
    payloadProof: jsonb("payload_proof"), // pour surprise: { screenshotUrl, claimedViews }
    status: text("status").notNull().default("approved"), // approved|pending|rejected
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_completions_user_week_idx").on(t.userId, t.weekStart),
    index("activity_completions_status_idx").on(t.status, t.createdAt),
  ],
);

export const insertActivityCompletionSchema = createInsertSchema(activityCompletionsTable).omit({
  id: true, createdAt: true,
});
export type InsertActivityCompletion = z.infer<typeof insertActivityCompletionSchema>;
export type ActivityCompletion = typeof activityCompletionsTable.$inferSelect;
