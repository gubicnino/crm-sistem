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
 *
 * KNOWN, REVIEWED TRADE-OFF: this does not re-check trainers.deactivatedAt
 * per request. Sessions are stateless JWTs (lib/auth.ts, session.strategy:
 * "jwt"), so db/queries/admin.ts's deactivateTrainer blocks a NEW login
 * immediately (lib/auth.ts's authorize()) and cancels scheduled emails
 * immediately, but an already-issued session/cookie for that trainer (or an
 * admin already impersonating them) keeps dashboard access until that JWT's
 * natural expiry. Closing this fully would need a per-request DB lookup here
 * plus a new terminal (non-auth-page) redirect target to avoid a /login <->
 * /leads loop for a now-invalid session. Deliberately deferred — single-
 * operator system, low blast radius — see the admin-impersonation plan doc.
 */
export async function requireTrainer(): Promise<TrainerScope> {
  // Dynamic import so this file's pure helpers (ownedBy/scoped/systemScope) can
  // be imported — e.g. in __tests__/tenant-scoping.test.ts — without pulling in
  // next-auth, which transitively needs Next's own server runtime to resolve.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const trainerId = session?.user?.trainerId;
  if (!trainerId) {
    // An admin who hasn't entered a trainer has no effective tenant. Send them
    // to their own console, not /login — proxy.ts bounces any cookie-bearing
    // request off /login back into the dashboard, so /login here would be an
    // infinite redirect loop for an admin (see app/after-login/page.tsx).
    redirect(session?.user?.role === "admin" ? "/admin" : "/login");
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
 *  - operator_cli       one-off scripts run by the operator from a terminal (no session)
 *  - admin_console      the operator console acting ON a trainer WITHOUT
 *                       impersonating them (from-email, deactivation) — always
 *                       behind requireAdminOrThrow(). Impersonation itself
 *                       deliberately does NOT use this reason: the impersonated
 *                       id comes from the signed session, not from here — see
 *                       lib/impersonation.ts.
 */
export function systemScope(
  trainerId: string,
  reason:
    | "site_key_ingest"
    | "form_config"
    | "cron_daily"
    | "unsubscribe_token"
    | "registration"
    | "operator_cli"
    | "admin_console",
): TrainerScope {
  void reason; // unused at runtime — exists so every call site states its justification
  return mintScope(trainerId);
}

// ---------------------------------------------------------------------------
// Operator authority
//
// A parallel set of guards for the admin console. An admin has no tenant of
// their own (no trainers row), so these return an AdminActor, never a
// TrainerScope. See lib/impersonation.ts for how an admin's session
// temporarily gains an effective trainerId (read by requireTrainer() above).
// ---------------------------------------------------------------------------

export interface AdminActor {
  readonly userId: string;
  readonly email: string | null;
  readonly name: string | null;
  /** Non-null while this admin is inside a trainer's dashboard. */
  readonly impersonatingTrainerId: string | null;
}

function toAdminActor(session: {
  user: { id?: string; email?: string | null; name?: string | null; impersonatingTrainerId: string | null };
}): AdminActor {
  return {
    userId: session.user.id ?? "",
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    impersonatingTrainerId: session.user.impersonatingTrainerId,
  };
}

/**
 * Operator-console entrypoint. Mirrors requireTrainer()'s redirect UX — NOT
 * the authorization boundary for mutations, see requireAdminOrThrow().
 */
export async function requireAdmin(): Promise<AdminActor> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/leads");
  return toAdminActor(session);
}

/** For admin Server Actions — same reasoning as requireTrainerOrThrow(). */
export async function requireAdminOrThrow(): Promise<AdminActor> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Not authenticated as admin");
  }
  return toAdminActor(session);
}

/** Read-only impersonation state for the dashboard layout's banner. Returns
 *  null for a normal trainer session (including a non-impersonating admin,
 *  which never reaches the dashboard layout — see requireTrainer()). */
export async function getImpersonation(): Promise<{ trainerId: string } | null> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const trainerId = session?.user?.impersonatingTrainerId;
  return trainerId ? { trainerId } : null;
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
