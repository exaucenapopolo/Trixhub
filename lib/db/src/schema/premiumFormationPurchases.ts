import { pgTable, serial, integer, text, timestamp, decimal } from "drizzle-orm/pg-core";

export const premiumFormationPurchasesTable = pgTable("premium_formation_purchases", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull(),
  formationId: text("formation_id").notNull(),
  priceFcfa: integer("price_fcfa").notNull(),
  currency: text("currency").notNull().default("XOF"),
  priceInCurrency: decimal("price_in_currency", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PremiumFormationPurchase = typeof premiumFormationPurchasesTable.$inferSelect;
