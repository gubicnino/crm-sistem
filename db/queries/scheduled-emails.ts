import { and, count, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { leads, scheduledEmails, type NewScheduledEmail, type ScheduledEmail } from "@/db/schema";
import type { ScheduledEmailKind, ScheduledEmailStatus } from "@/db/types";
import { RECONCILE_RETRY_MAX_HOURS, RECONCILE_RETRY_MIN_MINUTES } from "@/lib/email/constants";
import { scoped, type TrainerScope } from "@/lib/tenant";

export interface ReserveScheduledEmailInput {
  leadId: string;
  sequenceStep: string;
  /** Typed step link — see scheduledEmails.stepId's doc in db/schema.ts. */
  stepId: string | null;
  /** Set only for kind: "broadcast" rows — see scheduledEmails.broadcastId's
   *  doc in db/schema.ts. */
  broadcastId?: string;
  kind: ScheduledEmailKind;
  scheduledFor: Date;
  /** Defaults to 1 (a lead's first enrollment in this step). Phase 4's
   *  applySequenceToExistingLeads passes attempt > 1 when re-enrolling a
   *  lead already enrolled once, after the trainer edits a live sequence —
   *  see lib/email/reapply.ts. */
  attempt?: number;
}

/**
 * Reserve step of the scheduling protocol — see lib/email/schedule.ts.
 * onConflictDoNothing on (leadId, sequenceStep, attempt) makes this
 * idempotent: only rows that did not already exist are returned, so a
 * caller (including the cron reconciler) can call this blindly and safely.
 */
export async function reserveScheduledEmails(
  scope: TrainerScope,
  inputs: ReserveScheduledEmailInput[],
): Promise<ScheduledEmail[]> {
  if (inputs.length === 0) return [];
  const values: NewScheduledEmail[] = inputs.map((input) => ({
    trainerId: scope.trainerId,
    leadId: input.leadId,
    sequenceStep: input.sequenceStep,
    stepId: input.stepId,
    broadcastId: input.broadcastId ?? null,
    kind: input.kind,
    scheduledFor: input.scheduledFor,
    attempt: input.attempt ?? 1,
    status: "pending",
  }));
  return db
    .insert(scheduledEmails)
    .values(values)
    .onConflictDoNothing({
      target: [scheduledEmails.leadId, scheduledEmails.sequenceStep, scheduledEmails.attempt],
    })
    .returning();
}

export interface ScheduledEmailPatch {
  status?: ScheduledEmailStatus;
  resendEmailId?: string;
  sentAt?: Date;
  canceledAt?: Date;
  lastError?: string | null;
}

/** Updates by bare primary key — no TrainerScope parameter, no tenant check
 *  of its own. Safe today because every call site (lib/email/schedule.ts,
 *  lib/email/cancel.ts) obtains `id` from a row that was already fetched
 *  through a scoped query (reserveScheduledEmails, listCancelableScheduledEmails,
 *  or the cron reconciler's lead-derived systemScope) — never from a
 *  caller-supplied string. A future call site that passes a client-supplied
 *  id directly would reintroduce an IDOR; don't add one without scoping it
 *  first, the same way every existing caller does. */
export async function updateScheduledEmail(id: string, patch: ScheduledEmailPatch): Promise<void> {
  await db.update(scheduledEmails).set(patch).where(eq(scheduledEmails.id, id));
}

/** Same no-own-scope precondition as updateScheduledEmail above — see its
 *  doc. Conditional update so re-applying a transition (e.g. a double-cancel)
 *  is a harmless no-op — only a row currently in `fromStatus` is touched.
 *  Returns whether a row actually transitioned. */
export async function updateScheduledEmailIfStatus(
  id: string,
  fromStatus: ScheduledEmailStatus,
  patch: ScheduledEmailPatch,
): Promise<boolean> {
  const rows = await db
    .update(scheduledEmails)
    .set(patch)
    .where(and(eq(scheduledEmails.id, id), eq(scheduledEmails.status, fromStatus)))
    .returning();
  return rows.length > 0;
}

/**
 * Non-terminal rows for a lead — the set cancellation must act on.
 *
 * Deliberately NOT filtered by `scheduledFor > now()`: a `pending` row past
 * its scheduledFor was never actually confirmed sent (no resendEmailId) —
 * excluding it here would strand it, unreachable by any cancellation trigger,
 * since the reconciler also skips unsubscribed leads. Discovered live: a
 * lead's day-0 step (60s window) had already elapsed by the time its
 * unsubscribe request landed, and a time filter here left it orphaned in
 * `pending` forever. For a `scheduled` row past its time, attempting
 * resend.emails.cancel() anyway is harmless — the "already sent" branch in
 * lib/email/cancel.ts handles it.
 */
export async function listCancelableScheduledEmails(
  scope: TrainerScope,
  leadId: string,
): Promise<ScheduledEmail[]> {
  return db
    .select()
    .from(scheduledEmails)
    .where(
      scoped(
        scheduledEmails,
        scope,
        eq(scheduledEmails.leadId, leadId),
        inArray(scheduledEmails.status, ["scheduled", "pending"]),
      ),
    );
}

/**
 * Same as listCancelableScheduledEmails, minus the leadId filter — every
 * non-terminal row for the whole trainer. Used by
 * lib/email/cancel.ts's cancelAllSequencesForTrainer when the operator
 * console deactivates a trainer (db/queries/admin.ts's setTrainerDeactivated).
 */
export async function listCancelableScheduledEmailsForTrainer(scope: TrainerScope): Promise<ScheduledEmail[]> {
  return db
    .select()
    .from(scheduledEmails)
    .where(scoped(scheduledEmails, scope, inArray(scheduledEmails.status, ["scheduled", "pending"])));
}

/**
 * Cross-tenant by necessity: the cron reconciler's retry window. Pending rows
 * aged RECONCILE_RETRY_MIN_MINUTES-RECONCILE_RETRY_MAX_HOURS get a fresh send
 * attempt with the same idempotency key; rows outside that window are handled
 * separately (too young: give the original request more time; too old: mark
 * orphaned via markOrphanedPendingScheduledEmails, never retried).
 */
export async function listRetryablePendingScheduledEmails(limit: number): Promise<ScheduledEmail[]> {
  const now = Date.now();
  const newestRetryable = new Date(now - RECONCILE_RETRY_MIN_MINUTES * 60 * 1000);
  const oldestRetryable = new Date(now - RECONCILE_RETRY_MAX_HOURS * 60 * 60 * 1000);
  return db
    .select()
    .from(scheduledEmails)
    .where(
      and(
        eq(scheduledEmails.status, "pending"),
        lt(scheduledEmails.createdAt, newestRetryable),
        gt(scheduledEmails.createdAt, oldestRetryable),
      ),
    )
    .limit(limit);
}

/**
 * Pending rows older than the safe retry window. Past this point Resend's
 * idempotency-key TTL (~24h) has likely expired, so retrying risks a
 * double-send with no way to confirm whether the original request landed —
 * these are marked `orphaned` and surfaced in the digest instead.
 */
export async function markOrphanedPendingScheduledEmails(): Promise<number> {
  const cutoff = new Date(Date.now() - RECONCILE_RETRY_MAX_HOURS * 60 * 60 * 1000);
  const rows = await db
    .update(scheduledEmails)
    .set({ status: "orphaned" })
    .where(and(eq(scheduledEmails.status, "pending"), lt(scheduledEmails.createdAt, cutoff)))
    .returning({ id: scheduledEmails.id });
  return rows.length;
}

/** Used by the digest to surface operational problems (see lib/cron/digest.ts). */
export async function countScheduledEmailsByStatus(
  scope: TrainerScope,
  statuses: ScheduledEmailStatus[],
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(scheduledEmails)
    .where(scoped(scheduledEmails, scope, inArray(scheduledEmails.status, statuses)));
  return row?.total ?? 0;
}

export interface ScheduledEmailWithLead extends ScheduledEmail {
  leadName: string | null;
  leadEmail: string;
}

/** Powers the /emails dashboard tab — every scheduled_emails row for this
 *  trainer, joined with the lead's display name/email. */
export async function listScheduledEmailsForTrainer(scope: TrainerScope): Promise<ScheduledEmailWithLead[]> {
  return db
    .select({
      id: scheduledEmails.id,
      trainerId: scheduledEmails.trainerId,
      leadId: scheduledEmails.leadId,
      kind: scheduledEmails.kind,
      sequenceStep: scheduledEmails.sequenceStep,
      stepId: scheduledEmails.stepId,
      broadcastId: scheduledEmails.broadcastId,
      attempt: scheduledEmails.attempt,
      resendEmailId: scheduledEmails.resendEmailId,
      scheduledFor: scheduledEmails.scheduledFor,
      status: scheduledEmails.status,
      sentAt: scheduledEmails.sentAt,
      canceledAt: scheduledEmails.canceledAt,
      lastError: scheduledEmails.lastError,
      createdAt: scheduledEmails.createdAt,
      updatedAt: scheduledEmails.updatedAt,
      leadName: leads.name,
      leadEmail: leads.email,
    })
    .from(scheduledEmails)
    .innerJoin(leads, eq(scheduledEmails.leadId, leads.id))
    .where(scoped(scheduledEmails, scope))
    .orderBy(desc(scheduledEmails.scheduledFor));
}
