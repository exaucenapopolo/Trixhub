import { pgTable, text, serial, timestamp, integer, boolean, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Calendrier des activités planifiées par l'admin.
 * - Le quiz IA est toujours disponible (géré par code, pas par schedule).
 * - Les autres activités (video, discovery, surprise) nécessitent une entrée ici
 *   pour être disponibles un jour donné.
 * - Si is_enabled = false, l'activité est masquée ce jour-là même si planifiée.
 */
export const activitySchedulesTable = pgTable(
  "activity_schedules",
  {
    id: serial("id").primaryKey(),
    activityType: text("activity_type").notNull(), // 'video' | 'discovery' | 'surprise'
    scheduledDate: date("scheduled_date").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    notes: text("notes"),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activity_schedules_type_date_uniq").on(t.activityType, t.scheduledDate),
  ],
);

export const insertActivityScheduleSchema = createInsertSchema(activitySchedulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActivitySchedule = z.infer<typeof insertActivityScheduleSchema>;
export type ActivitySchedule = typeof activitySchedulesTable.$inferSelect;
