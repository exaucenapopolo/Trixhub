import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Pool d'activités gérées par l'admin (vidéos, découvertes, surprises template).
 * Le quiz n'apparaît PAS ici car il est généré par IA à la volée.
 */
export const activitiesTable = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // 'video' | 'discovery' | 'surprise'
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"), // YouTube/TikTok pour video, site externe pour discovery
    payload: jsonb("payload"), // metadata libre (durée min, params, vues cibles surprise)
    pointsReward: integer("points_reward").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("activities_type_active_idx").on(t.type, t.isActive)],
);

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
