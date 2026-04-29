import { pgTable, text, serial, timestamp, integer, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Demandes de retrait du solde activité (table séparée du retrait parrainage classique).
 * Toujours validées manuellement par l'admin via WhatsApp pour anti-fraude.
 *
 * status : pending → approved → paid | rejected
 */
export const activityWithdrawalsTable = pgTable(
  "activity_withdrawals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    method: text("method").notNull(), // 'orange_money'|'mtn_money'|'wave'|'moov'
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    country: text("country"),
    status: text("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    rejectionReason: text("rejection_reason"),
    twilioSentAt: timestamp("twilio_sent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("activity_withdrawals_user_status_idx").on(t.userId, t.status)],
);

export const insertActivityWithdrawalSchema = createInsertSchema(activityWithdrawalsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertActivityWithdrawal = z.infer<typeof insertActivityWithdrawalSchema>;
export type ActivityWithdrawal = typeof activityWithdrawalsTable.$inferSelect;
