import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

/**
 * Passed into NextAuth's `adapter` option (lib/auth.ts). Custom tables so DB
 * columns can follow this project's snake_case convention while the TS
 * property names still match what @auth/core's Adapter/AdapterUser/
 * AdapterAccount types require verbatim — see db/schema.ts's comment on the
 * Auth.js adapter tables. Kept in db/queries/** so @/db stays confined to this
 * boundary (see eslint.config.mjs's no-restricted-imports zone).
 */
export const authAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});
