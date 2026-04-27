import { pgTable, text, serial, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // "referral_l1", "referral_l2", "referral_l3", "task", "activation", "withdrawal"
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  relatedUserId: integer("related_user_id"),
  level: integer("level"),
  status: text("status").notNull().default("completed"), // "pending", "completed", "cancelled"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
