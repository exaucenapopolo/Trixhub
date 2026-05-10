import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const apkDownloadsTable = pgTable("apk_downloads", {
  id: serial("id").primaryKey(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ApkDownload = typeof apkDownloadsTable.$inferSelect;
