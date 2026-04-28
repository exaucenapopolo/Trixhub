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
  source: text("source").notNull().default("referral"), // "referral" | "task"
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "rejected"
  rejectionReason: text("rejection_reason"),
  // URL de la preuve de paiement (capture d'écran SMS) uploadée par l'utilisateur après réception.
  proofUrl: text("proof_url"),
  proofToken: text("proof_token"), // jeton aléatoire (32 octets) pour sécuriser l'accès au fichier
  proofUploadedAt: timestamp("proof_uploaded_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
