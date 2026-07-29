import { and, desc, eq, gte, inArray, isNull, notExists, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, scheduledEmails, type Lead, type LeadSource, type PipelineStage } from "@/db/schema";
import type { LeadAnswers } from "@/db/types";
import { scoped, type TrainerScope } from "@/lib/tenant";
import { isTerminalStage, TERMINAL_STAGES } from "@/lib/pipeline";
import type { ManualLeadInput } from "@/lib/validation/leads";

export interface ListLeadsFilters {
  stage?: PipelineStage;
  source?: LeadSource;
}

export async function listLeads(scope: TrainerScope, filters: ListLeadsFilters = {}): Promise<Lead[]> {
  const conditions = [];
  if (filters.stage) conditions.push(eq(leads.stage, filters.stage));
  if (filters.source) conditions.push(eq(leads.source, filters.source));

  return db
    .select()
    .from(leads)
    .where(scoped(leads, scope, ...conditions))
    .orderBy(desc(leads.createdAt));
}

export async function getLead(scope: TrainerScope, leadId: string): Promise<Lead | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .limit(1);
  return lead ?? null;
}

/** Fetches a trainer's own leads by id, scoped — used by
 *  lib/email/broadcast.ts to resolve the trainer's checkbox selection.
 *  Scoping here (not just trusting the client-supplied id list) is the
 *  whole point: a lead id belonging to another trainer is silently
 *  dropped from the result, never fetched. */
export async function listLeadsByIds(scope: TrainerScope, leadIds: string[]): Promise<Lead[]> {
  if (leadIds.length === 0) return [];
  return db
    .select()
    .from(leads)
    .where(scoped(leads, scope, inArray(leads.id, leadIds)));
}

export interface CreateLeadFromIntakeInput {
  name?: string;
  email: string;
  phone?: string;
  source: LeadSource;
  stage: PipelineStage;
  answers?: LeadAnswers;
}

export interface CreateLeadFromIntakeResult {
  lead: Lead;
  isNew: boolean;
}

/**
 * Fields a non-`application` (i.e. `lead_magnet`) resubmission may refresh —
 * `name`/`phone` only, and only the ones this particular submission actually
 * provided. Drizzle's `.set()` throws "No values to set" if given an object
 * with zero defined keys, which a bare email-only lead_magnet resubmission
 * (no name, no phone — the common case; CLAUDE.md: lead_magnet data is
 * "usually just email (+ maybe name)") would otherwise trigger. When neither
 * is provided there is nothing to refresh, so fall back to touching
 * `updatedAt` — a harmless, self-consistent write that keeps `.set()`
 * well-formed without silently clearing a previously known name/phone (which
 * leaving them `undefined` would NOT do, but coalescing them to `null`
 * would have).
 */
function leadMagnetRefreshFields(input: CreateLeadFromIntakeInput): {
  name?: string;
  phone?: string;
  updatedAt?: Date;
} {
  const refresh: { name?: string; phone?: string; updatedAt?: Date } = {};
  if (input.name !== undefined) refresh.name = input.name;
  if (input.phone !== undefined) refresh.phone = input.phone;
  if (Object.keys(refresh).length === 0) {
    refresh.updatedAt = new Date();
  }
  return refresh;
}

/**
 * Upsert on (trainerId, email) — see the unique index in db/schema.ts. A
 * repeat submission from the same person (regardless of source) updates the
 * existing row instead of creating a duplicate, and — because the caller
 * only schedules an email sequence when `isNew` is true — can't
 * double-schedule one either.
 *
 * Implemented as insert-with-onConflictDoNothing, then a follow-up update on
 * conflict, rather than a single onConflictDoUpdate: this makes "was it a
 * genuine insert" a plain JS boolean instead of a Postgres `xmax = 0` trick.
 *
 * Stage handling on conflict, per CLAUDE.md's "Lead deduplication on form
 * resubmission": only an incoming `application` submission can change
 * `stage`, and only by advancing out of `email_lead` into
 * `application_received` — a lead already `contacted`, `client`, or `lost`
 * must never move backward on the kanban board just because the form was
 * filled out again. A `lead_magnet` resubmission never touches `stage`,
 * `source`, or `answers` — it can only refresh `name`/`phone`. An
 * `application` resubmission additionally merges `source` to `application`
 * and overwrites `answers`, even if the existing row was `lead_magnet` — one
 * email is one lead, regardless of which form it came through.
 */
export async function createLeadFromIntake(
  scope: TrainerScope,
  input: CreateLeadFromIntakeInput,
): Promise<CreateLeadFromIntakeResult> {
  const [inserted] = await db
    .insert(leads)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      stage: input.stage,
      answers: input.answers,
    })
    .onConflictDoNothing({ target: [leads.trainerId, leads.email] })
    .returning();

  if (inserted) {
    return { lead: inserted, isNew: true };
  }

  const [updated] = await db
    .update(leads)
    .set(
      input.source === "application"
        ? {
            name: input.name,
            phone: input.phone,
            source: "application" as const,
            answers: input.answers,
            stage: sql`CASE WHEN ${leads.stage} = 'email_lead' THEN 'application_received'::pipeline_stage ELSE ${leads.stage} END`,
            // Mirrors the stage CASE above so stageChangedAt only moves when
            // stage actually does — stuck-lead detection (lib/cron/stuck-leads.ts)
            // reads this column, and a stale value would corrupt it the moment
            // a lead legitimately advances via a resubmission.
            stageChangedAt: sql`CASE WHEN ${leads.stage} = 'email_lead' THEN ${new Date()} ELSE ${leads.stageChangedAt} END`,
          }
        : leadMagnetRefreshFields(input),
    )
    .where(scoped(leads, scope, eq(leads.email, input.email)))
    .returning();

  if (updated && input.source === "application" && !isTerminalStage(updated.stage)) {
    // Phase 3: same sync/enroll pair as setLeadStage's non-terminal branch —
    // safe to call even when the CASE above left `stage` unchanged, since
    // both are idempotent: reserveScheduledEmails' unique index no-ops a
    // repeat enrollment, and sync just re-evaluates the (possibly-unchanged)
    // current stage. The isTerminalStage guard is explicit defense in depth,
    // not strictly load-bearing today (a lead already at client/lost was
    // already fully canceled when it got there, and no sequence can ever
    // have triggerStage set to a terminal stage — rejected in
    // lib/validation/email-sequences.ts) — but skipping the call outright
    // means this property doesn't silently depend on those two other
    // invariants never changing.
    const { syncScheduledEmailsForLeadStage } = await import("@/lib/email/cancel");
    await syncScheduledEmailsForLeadStage(scope, updated.id, updated.stage);
    const { enrollLeadOnStageEntered } = await import("@/lib/email/enroll");
    await enrollLeadOnStageEntered(scope, updated, updated.stage);
  }

  return { lead: updated, isNew: false };
}

/**
 * The only function through which a *user-driven* stage change (kanban drag,
 * detail dropdown, bulk action) may happen — see CLAUDE.md's most damaging
 * failure mode (a converted/lost lead still receiving follow-ups).
 * Cancellation on `client`/`lost` lives HERE, not in the caller, specifically
 * so it cannot be forgotten by a new UI call site.
 *
 * Phase 3: every NON-terminal transition also (a) re-evaluates already-
 * scheduled steps whose sendOnlyIfStage condition may now exclude the new
 * stage (syncScheduledEmailsForLeadStage — cancellation is the entire
 * enforcement mechanism for that condition, see lib/email/cancel.ts) and
 * (b) enrolls the lead into any sequence whose trigger is exactly "entered
 * this stage" (enrollLeadOnStageEntered). Both are skipped on a terminal
 * transition — cancelSequenceForLead below already cancels everything
 * unconditionally, and a stage_entered trigger can never target client/lost
 * in the first place (rejected in lib/validation/email-sequences.ts).
 *
 * The one other place `stage` is written is createLeadFromIntake's own
 * conflict-path CASE expression above, for the dedup-driven `email_lead` ->
 * `application_received` auto-advance — that path can never reach a
 * terminal stage (its CASE only ever targets `application_received`), so it
 * has no cancellation obligation, but it does call the same Phase 3
 * sync/enroll pair as this function's non-terminal branch (see its own
 * comment). eslint.config.mjs's no-restricted-syntax rule exempts this
 * whole file rather than special-casing either function.
 */
export async function setLeadStage(scope: TrainerScope, leadId: string, next: PipelineStage): Promise<Lead> {
  const [updated] = await db
    .update(leads)
    .set({ stage: next, stageChangedAt: new Date() })
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .returning();

  if (!updated) {
    throw new Error("Lead not found or not owned by this trainer.");
  }

  // Dynamic imports throughout: avoids forcing every consumer of this file
  // (including plain reads like listLeads) to eagerly load lib/email/client.ts,
  // which throws at module-init time if RESEND_API_KEY is unset.
  if (isTerminalStage(next)) {
    const { cancelSequenceForLead } = await import("@/lib/email/cancel");
    await cancelSequenceForLead(scope, leadId);
  } else {
    const { syncScheduledEmailsForLeadStage } = await import("@/lib/email/cancel");
    await syncScheduledEmailsForLeadStage(scope, leadId, next);
    const { enrollLeadOnStageEntered } = await import("@/lib/email/enroll");
    await enrollLeadOnStageEntered(scope, updated, next);
  }

  return updated;
}

/**
 * Unscoped by necessity: this is how a TrainerScope is bootstrapped for the
 * public unsubscribe page, which only has a leadId (from a verified HMAC
 * token) and needs to discover which trainer owns it.
 */
export async function getLeadByIdUnscoped(leadId: string): Promise<Lead | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  return lead ?? null;
}

export async function markLeadUnsubscribed(scope: TrainerScope, leadId: string): Promise<void> {
  await db
    .update(leads)
    .set({ unsubscribedAt: new Date() })
    .where(scoped(leads, scope, eq(leads.id, leadId)));
}

/**
 * Cross-tenant by necessity: the cron reconciler (Phase 6) scans for leads
 * created in the last `sinceDays` with zero scheduled_emails rows — e.g.
 * Resend/the DB was down at creation time, so enrollLeadOnCreate's
 * reserve step never ran. Excludes unsubscribed leads and terminal stages,
 * which must never get a sequence (re-)started.
 */
export async function listLeadsMissingScheduledEmails(sinceDays: number, limit: number): Promise<Lead[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(leads)
    .where(
      and(
        gte(leads.createdAt, since),
        isNull(leads.unsubscribedAt),
        notInArray(leads.stage, [...TERMINAL_STAGES]),
        notExists(db.select().from(scheduledEmails).where(eq(scheduledEmails.leadId, leads.id))),
      ),
    )
    .limit(limit);
}

/** A trainer manually adding a lead always starts it cold, at the same entry
 *  point as a lead_magnet capture — see CLAUDE.md's pipeline stages. */
export async function createLead(scope: TrainerScope, input: ManualLeadInput): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: "application",
      stage: "email_lead",
    })
    .returning();
  return lead;
}

export async function updateLead(
  scope: TrainerScope,
  leadId: string,
  input: ManualLeadInput,
): Promise<Lead | null> {
  const [updated] = await db
    .update(leads)
    .set({ name: input.name, email: input.email, phone: input.phone })
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .returning();
  return updated ?? null;
}

/** Returns whether a row was actually deleted. Caller is responsible for
 *  canceling outstanding sequence emails first — see deleteLeadAction in
 *  lib/actions/leads.ts — since the scheduled_emails cascade delete here
 *  only removes the local record, not the Resend-side scheduled send. */
export async function deleteLead(scope: TrainerScope, leadId: string): Promise<boolean> {
  const rows = await db
    .delete(leads)
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .returning();
  return rows.length > 0;
}
