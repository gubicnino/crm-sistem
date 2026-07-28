import { redirect } from "next/navigation";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

declare const TRAINER_SCOPE: unique symbol;

/**
 * Proof that a trainerId was derived from a trusted source (an authenticated
 * session, or one of systemScope()'s closed reasons below). A raw string
 * cannot be assigned to this type, so a trainerId that leaked in from a URL
 * param or request body can't silently satisfy a function that expects one.
 * See CLAUDE.md "Tenant isolation is non-negotiable".
 */
export type TrainerScope = {
  readonly trainerId: string;
  readonly [TRAINER_SCOPE]: true;
};

function mintScope(trainerId: string): TrainerScope {
  return { trainerId } as TrainerScope;
}

/**
 * Dashboard entrypoint. Redirects to /login if there's no session — use this
 * in layouts/pages for the redirect UX. NOT the authorization boundary: see
 * requireTrainerOrThrow() and proxy.ts's header comment for why.
 */
export async function requireTrainer(): Promise<TrainerScope> {
  // Dynamic import so this file's pure helpers (ownedBy/scoped/systemScope) can
  // be imported — e.g. in __tests__/tenant-scoping.test.ts — without pulling in
  // next-auth, which transitively needs Next's own server runtime to resolve.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const trainerId = session?.user?.trainerId;
  if (!trainerId) {
    redirect("/login");
  }
  return mintScope(trainerId);
}

/**
 * For Server Actions and data-access functions, which must authorize
 * themselves independently — Next 16 dispatches Server Actions as POSTs to the
 * page route, so a proxy matcher cannot be trusted to gate them. Throws
 * instead of redirecting, since an action returns a result, not a page.
 */
export async function requireTrainerOrThrow(): Promise<TrainerScope> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const trainerId = session?.user?.trainerId;
  if (!trainerId) {
    throw new Error("Not authenticated");
  }
  return mintScope(trainerId);
}

/**
 * The only string -> TrainerScope door outside an authenticated session. The
 * closed `reason` union makes every call site greppable and auditable:
 *  - site_key_ingest    public /api/leads route, after resolving site_key -> trainer
 *  - form_config        public form-config endpoint, same resolution
 *  - cron_daily         daily cron, iterating all trainers server-side
 *  - unsubscribe_token  public unsubscribe page, after verifying the HMAC token
 *  - registration       invite redemption, immediately after creating the trainer row
 */
export function systemScope(
  trainerId: string,
  reason: "site_key_ingest" | "form_config" | "cron_daily" | "unsubscribe_token" | "registration",
): TrainerScope {
  void reason; // unused at runtime — exists so every call site states its justification
  return mintScope(trainerId);
}

/** The only sanctioned way to write a trainer_id predicate. */
export function ownedBy<T extends { trainerId: PgColumn }>(table: T, scope: TrainerScope): SQL {
  return eq(table.trainerId, scope.trainerId);
}

/** Same as ownedBy, plus additional conditions ANDed in. */
export function scoped<T extends { trainerId: PgColumn }>(
  table: T,
  scope: TrainerScope,
  ...extra: (SQL | undefined)[]
): SQL {
  // ownedBy(...) is always defined, so `and` here always has >=1 defined arg.
  return and(ownedBy(table, scope), ...extra)!;
}
