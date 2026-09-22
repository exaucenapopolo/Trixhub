import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? process.env.trixhub_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,                  // max connexions simultanées (défaut pg = 10)
  idleTimeoutMillis: 30000, // ferme les connexions inactives après 30s
  connectionTimeoutMillis: 5000, // timeout si pas de connexion dispo en 5s
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
