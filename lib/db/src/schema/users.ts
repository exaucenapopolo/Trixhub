import { pgTable, text, serial, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActivated: boolean("is_activated").notNull().default(false),
  referralCode: text("referral_code").notNull().unique(),
  referredByCode: text("referred_by_code"),
  preferredCurrency: text("preferred_currency").notNull().default("FCFA"),
  isBanned: boolean("is_banned").notNull().default(false),
  loginAttempts: serial("login_attempts"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true, loginAttempts: true
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
