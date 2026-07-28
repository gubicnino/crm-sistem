import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Standalone scripts (drizzle-kit, db/migrate.ts) don't go through Next's env
// loader, which auto-reads .env.local. dotenv's default import only reads
// ".env", so the path must be explicit here.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
