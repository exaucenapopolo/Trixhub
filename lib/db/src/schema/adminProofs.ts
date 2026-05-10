import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const adminProofsTable = pgTable("admin_proofs", {
  id: serial("id").primaryKey(),
  userName: text("user_name").notNull(),
  country: text("country").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  imageToken: text("image_token").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminProof = typeof adminProofsTable.$inferSelect;
