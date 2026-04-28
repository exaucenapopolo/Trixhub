import { pgTable, text, serial, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const balancesTable = pgTable("balances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  referralBalance: decimal("referral_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  taskBalance: decimal("task_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  bonusBalance: decimal("bonus_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  depositBalance: decimal("deposit_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  inactiveBalance: decimal("inactive_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  withdrawnAmount: decimal("withdrawn_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  spentAmount: decimal("spent_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBalanceSchema = createInsertSchema(balancesTable).omit({ id: true });
export type InsertBalance = z.infer<typeof insertBalanceSchema>;
export type Balance = typeof balancesTable.$inferSelect;
