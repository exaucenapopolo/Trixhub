import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.trixhub_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("trixhub_DATABASE_URL must be set. Did you forget to provision the database?");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
