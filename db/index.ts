import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const sql = neon(process.env.DATABASE_URL);

/**
 * neon-http issues one HTTP request per query and has no interactive
 * `db.transaction()` — calling it throws at runtime with this driver. Where
 * atomicity is needed, use `db.batch([...])` instead (Neon runs it as a single
 * transaction over HTTP); see lib/actions/auth.ts for the registration/invite-
 * redemption use of this. Everything else in this app is designed to tolerate
 * the lack of transactions (single atomic statements, or — for email
 * scheduling — a reserve/send/commit protocol that's safe to interrupt).
 */
export const db = drizzle(sql, { schema });
