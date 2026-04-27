import { pgTable, text, serial, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: decimal("reward", { precision: 15, scale: 2 }).notNull(),
  type: text("type").notNull(), // "social", "survey", "video", "referral", "bonus"
  url: text("url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTasksTable = pgTable("user_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const insertUserTaskSchema = createInsertSchema(userTasksTable).omit({ id: true });
export type InsertUserTask = z.infer<typeof insertUserTaskSchema>;
export type UserTask = typeof userTasksTable.$inferSelect;
