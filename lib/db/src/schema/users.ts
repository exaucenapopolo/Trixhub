import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  country: text("country").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActivated: boolean("is_activated").notNull().default(false),
  referralCode: text("referral_code").notNull().unique(),
  referredByCode: text("referred_by_code"),
  preferredCurrency: text("preferred_currency").notNull().default("FCFA"),
  themePreference: text("theme_preference").notNull().default("light"),
  isBanned: boolean("is_banned").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  loginAttempts: serial("login_attempts"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Anti-fraude : un utilisateur ne peut faire qu'une seule demande de chaque type.
  canvaRequestedAt: timestamp("canva_requested_at", { withTimezone: true }),
  formationRequestedAt: timestamp("formation_requested_at", { withTimezone: true }),
  formationRequestedTitle: text("formation_requested_title"),
  // Bonus de connexion quotidien : timestamp de la dernière attribution.
  lastDailyBonusAt: timestamp("last_daily_bonus_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true, loginAttempts: true
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
