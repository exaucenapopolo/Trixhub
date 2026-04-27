import { pgTable, text, serial, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  method: text("method").notNull(), // "orange_money", "mtn_money", "wave", "moov"
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "rejected"
  rejectionReason: text("rejection_reason"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
