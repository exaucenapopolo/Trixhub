import { pgTable, serial, integer, decimal, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const contactPurchasesTable = pgTable("contact_purchases", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceFcfa: decimal("price_fcfa", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XOF"),
  priceInCurrency: decimal("price_in_currency", { precision: 15, scale: 2 }).notNull(),
  contactIds: jsonb("contact_ids").notNull().$type<number[]>(),
  orderType: text("order_type").notNull().default("newest"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContactPurchase = typeof contactPurchasesTable.$inferSelect;
