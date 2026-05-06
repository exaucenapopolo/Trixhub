import { pgTable, text, serial, timestamp, decimal, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  method: text("method").notNull(), // id AccountPE ("mtn_cm", "orange_cm"...) ou id interne tâches
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  whatsappNumber: text("whatsapp_number"), // numéro WhatsApp du membre (obligatoire retrait parrainage)
  source: text("source").notNull().default("referral"), // "referral" | "task"
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "rejected"
  rejectionReason: text("rejection_reason"),
  // Frais de retrait
  feeMode: text("fee_mode").notNull().default("from_amount"), // "from_amount" | "from_balance"
  feeAmount: integer("fee_amount"),       // montant des frais prélevés (FCFA, pour traçabilité)
  // Payout automatique AccountPE (source=referral uniquement)
  payoutRef: text("payout_ref"),          // id/référence renvoyé par create_payout AccountPE
  payoutStatus: text("payout_status"),    // "pending" | "success" | "failed" (statut chez AccountPE)
  // URL de la preuve de paiement (capture d'écran SMS) uploadée par l'utilisateur après réception.
  proofUrl: text("proof_url"),
  proofToken: text("proof_token"), // jeton aléatoire (32 octets) pour sécuriser l'accès au fichier
  proofUploadedAt: timestamp("proof_uploaded_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("withdrawals_user_id_created_at_idx").on(t.userId, t.createdAt),
  index("withdrawals_status_idx").on(t.status),
  index("withdrawals_created_at_idx").on(t.createdAt),
]);

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
