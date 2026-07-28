import { and, desc, eq, gte, isNull, notExists, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { leads, scheduledEmails, type Lead, type LeadSource, type PipelineStage } from "@/db/schema";
import type { LeadAnswers } from "@/db/types";
import { scoped, type TrainerScope } from "@/lib/tenant";

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
 * Upsert on (trainerId, email, source) — see the unique index in db/schema.ts.
 * A repeat submission from the same person updates the existing row instead
 * of creating a duplicate, and — because the caller only schedules an email
 * sequence when `isNew` is true — can't double-schedule one either.
 *
 * Implemented as insert-with-onConflictDoNothing, then a follow-up update on
 * conflict, rather than a single onConflictDoUpdate: this makes "was it a
 * genuine insert" a plain JS boolean instead of a Postgres `xmax = 0` trick.
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
    .onConflictDoNothing({ target: [leads.trainerId, leads.email, leads.source] })
    .returning();

  if (inserted) {
    return { lead: inserted, isNew: true };
  }

  // Conflict: this (trainer, email, source) already exists. Update the fields
  // a resubmission might legitimately change — never `stage`, since a repeat
  // form submission must not reset a lead's pipeline position.
  const [updated] = await db
    .update(leads)
    .set({ name: input.name, phone: input.phone, answers: input.answers })
    .where(scoped(leads, scope, eq(leads.email, input.email), eq(leads.source, input.source)))
    .returning();

  return { lead: updated, isNew: false };
}

/**
 * The ONLY function that may change a lead's stage — see CLAUDE.md's most
 * damaging failure mode (a converted/lost lead still receiving follow-ups).
 * Cancellation on `client`/`lost` lives HERE, not in the caller, specifically
 * so it cannot be forgotten by a new UI call site. Every stage change (kanban
 * drag, detail dropdown, bulk action) must route through this function —
 * enforced by the eslint no-restricted-syntax rule forbidding `.set({ stage`
 * anywhere else (see eslint.config.mjs).
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

  if (next === "client" || next === "lost") {
    // Dynamic import: avoids forcing every consumer of this file (including
    // plain reads like listLeads) to eagerly load lib/email/client.ts, which
    // throws at module-init time if RESEND_API_KEY is unset.
    const { cancelSequenceForLead } = await import("@/lib/email/cancel");
    await cancelSequenceForLead(scope, leadId);
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
 * Resend/the DB was down at creation time, so scheduleSequenceForLead's
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
        notInArray(leads.stage, ["client", "lost"]),
        notExists(db.select().from(scheduledEmails).where(eq(scheduledEmails.leadId, leads.id))),
      ),
    )
    .limit(limit);
}
