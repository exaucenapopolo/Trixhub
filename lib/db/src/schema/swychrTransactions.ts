import { pgTable, text, serial, timestamp, decimal, integer } from "drizzle-orm/pg-core";

export const swychrTransactionsTable = pgTable("swychr_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  paymentRef: text("payment_ref").notNull().unique(),
  swychrRef: text("swychr_ref"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XAF"),
  phoneNumber: text("phone_number").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("pending"),
  purpose: text("purpose").notNull().default("activation"),
  paymentUrl: text("payment_url"),
  ussdCode: text("ussd_code"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SwychrTransaction = typeof swychrTransactionsTable.$inferSelect;
