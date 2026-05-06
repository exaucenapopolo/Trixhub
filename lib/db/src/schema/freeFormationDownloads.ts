import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const freeFormationDownloadsTable = pgTable("free_formation_downloads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  formationId: text("formation_id").notNull(),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FreeFormationDownload = typeof freeFormationDownloadsTable.$inferSelect;
