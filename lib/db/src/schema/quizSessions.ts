import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Session de quiz IA. Les questions (avec correctIndex) sont stockées côté serveur
 * pour validation lors du submit. Le client ne reçoit jamais les bonnes réponses.
 *
 * questions : [{ q: string, options: [string,string,string,string], correctIndex: 0..3 }]
 */
export const quizSessionsTable = pgTable(
  "quiz_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    questions: jsonb("questions").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    answers: jsonb("answers"), // [0, 2, 1, 3, 0]
    score: integer("score"), // 0..5
    pointsAwarded: integer("points_awarded"),
  },
  (t) => [index("quiz_sessions_user_idx").on(t.userId, t.startedAt)],
);

export const insertQuizSessionSchema = createInsertSchema(quizSessionsTable).omit({
  id: true, startedAt: true,
});
export type InsertQuizSession = z.infer<typeof insertQuizSessionSchema>;
export type QuizSession = typeof quizSessionsTable.$inferSelect;
