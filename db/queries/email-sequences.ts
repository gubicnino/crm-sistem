import { asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { emailSequences, emailSequenceSteps, type EmailSequence, type EmailSequenceStep } from "@/db/schema";
import type { LeadSource } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { ownedBy, scoped, type TrainerScope } from "@/lib/tenant";

/**
 * Deliberately its own type, not `EmailSequenceFormInput` (the Zod-inferred
 * one from lib/validation/email-sequences.ts) — this file has two call
 * sites: createEmailSequenceAction (whose input already passed
 * emailSequenceFormSchema, whose narrower literal-typed `body` satisfies
 * this looser shape) and lib/email/seed-defaults.ts (trusted, hand-built
 * seed content that has no reason to round-trip through Zod parsing). Using
 * `EmailDocNode` here — the general shape, not the Zod schema's exact
 * inferred union — is what makes both call sites typecheck without forcing
 * seed data through validation it doesn't need.
 */
export interface EmailSequenceStepData {
  id?: string;
  subject: string;
  body: EmailDocNode;
  dayOffset: number;
}

export interface EmailSequenceData {
  name: string;
  triggerSource: LeadSource | null;
  enabled: boolean;
  steps: EmailSequenceStepData[];
}

export class SequenceLimitExceededError extends Error {
  constructor() {
    super(`A trainer may have at most ${MAX_SEQUENCES_PER_TRAINER} sequences.`);
    this.name = "SequenceLimitExceededError";
  }
}

export interface EmailSequenceSummary extends EmailSequence {
  stepCount: number;
}

export interface EmailSequenceWithSteps {
  sequence: EmailSequence;
  steps: EmailSequenceStep[];
}

/** Powers the /emails/sequences list page. */
export async function listEmailSequencesForTrainer(scope: TrainerScope): Promise<EmailSequenceSummary[]> {
  const sequences = await db
    .select()
    .from(emailSequences)
    .where(ownedBy(emailSequences, scope))
    .orderBy(desc(emailSequences.createdAt));

  if (sequences.length === 0) return [];

  const counts = await db
    .select({ sequenceId: emailSequenceSteps.sequenceId, total: count() })
    .from(emailSequenceSteps)
    .where(ownedBy(emailSequenceSteps, scope))
    .groupBy(emailSequenceSteps.sequenceId);
  const countBySequence = new Map(counts.map((c) => [c.sequenceId, c.total]));

  return sequences.map((sequence) => ({ ...sequence, stepCount: countBySequence.get(sequence.id) ?? 0 }));
}

/** Powers the /emails/sequences/[id] edit page. Null if not found or owned
 *  by a different trainer — the page treats both identically (notFound()). */
export async function getEmailSequenceWithSteps(
  scope: TrainerScope,
  sequenceId: string,
): Promise<EmailSequenceWithSteps | null> {
  const [sequence] = await db
    .select()
    .from(emailSequences)
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .limit(1);
  if (!sequence) return null;

  const steps = await db
    .select()
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.sequenceId, sequenceId)))
    .orderBy(asc(emailSequenceSteps.position));

  return { sequence, steps };
}

/** Throws SequenceLimitExceededError at MAX_SEQUENCES_PER_TRAINER — checked
 *  here, not only in the UI, since the UI's disabled "new sequence" button
 *  is a courtesy, not the enforcement boundary. */
export async function createEmailSequence(
  scope: TrainerScope,
  input: EmailSequenceData,
): Promise<EmailSequence> {
  const [{ total }] = await db.select({ total: count() }).from(emailSequences).where(ownedBy(emailSequences, scope));
  if (total >= MAX_SEQUENCES_PER_TRAINER) {
    throw new SequenceLimitExceededError();
  }

  const [sequence] = await db
    .insert(emailSequences)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      triggerType: "lead_created",
      triggerSource: input.triggerSource,
      enabled: input.enabled,
    })
    .returning();

  await db.insert(emailSequenceSteps).values(
    input.steps.map((step, position) => ({
      trainerId: scope.trainerId,
      sequenceId: sequence.id,
      position,
      dayOffset: step.dayOffset,
      subject: step.subject,
      body: step.body,
    })),
  );

  return sequence;
}

/**
 * Full replace of the sequence's own fields, plus a diff of its steps: a
 * step with a matching existing `id` is updated in place (so
 * scheduled_emails.stepId links for already-scheduled sends stay valid), a
 * step with no `id` is a new insert, and any existing step absent from the
 * input is deleted. Sequential (not db.batch'd or transactional) — this
 * table has no external side effect (no Resend call), so a partial failure
 * here is a data inconsistency to retry, not a lost email; see db/index.ts's
 * documented tolerance for the neon-http driver's lack of transactions.
 */
export async function updateEmailSequence(
  scope: TrainerScope,
  sequenceId: string,
  input: EmailSequenceData,
): Promise<EmailSequence | null> {
  const [updatedSequence] = await db
    .update(emailSequences)
    .set({ name: input.name, triggerSource: input.triggerSource, enabled: input.enabled })
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .returning();
  if (!updatedSequence) return null;

  const existingSteps = await db
    .select({ id: emailSequenceSteps.id })
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.sequenceId, sequenceId)));
  const existingIds = new Set(existingSteps.map((s) => s.id));
  const keptIds = new Set(input.steps.filter((s) => s.id).map((s) => s.id as string));

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    await db
      .delete(emailSequenceSteps)
      .where(scoped(emailSequenceSteps, scope, inArray(emailSequenceSteps.id, removedIds)));
  }

  for (const [position, step] of input.steps.entries()) {
    if (step.id && existingIds.has(step.id)) {
      await db
        .update(emailSequenceSteps)
        .set({
          position,
          dayOffset: step.dayOffset,
          subject: step.subject,
          body: step.body,
        })
        .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.id, step.id)));
    } else {
      await db.insert(emailSequenceSteps).values({
        trainerId: scope.trainerId,
        sequenceId,
        position,
        dayOffset: step.dayOffset,
        subject: step.subject,
        body: step.body,
      });
    }
  }

  return updatedSequence;
}

/** The trainer's "vklopi/izklopi" toggle — does not touch steps. Returns
 *  whether a row was actually found and updated. */
export async function setEmailSequenceEnabled(
  scope: TrainerScope,
  sequenceId: string,
  enabled: boolean,
): Promise<boolean> {
  const rows = await db
    .update(emailSequences)
    .set({ enabled })
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .returning({ id: emailSequences.id });
  return rows.length > 0;
}

/**
 * Every enabled, lead_created-triggered sequence that matches this lead's
 * source (or targets any source) — what lib/email/enroll.ts's
 * enrollLeadOnCreate fans out over. A trainer can have more than one
 * matching sequence (e.g. one scoped to "application" and one with
 * triggerSource null); both get enrolled.
 */
export async function listEnabledSequencesForLeadCreated(
  scope: TrainerScope,
  source: LeadSource,
): Promise<EmailSequenceWithSteps[]> {
  const sequences = await db
    .select()
    .from(emailSequences)
    .where(
      scoped(
        emailSequences,
        scope,
        eq(emailSequences.enabled, true),
        eq(emailSequences.triggerType, "lead_created"),
        or(isNull(emailSequences.triggerSource), eq(emailSequences.triggerSource, source)),
      ),
    );
  if (sequences.length === 0) return [];

  const steps = await db
    .select()
    .from(emailSequenceSteps)
    .where(
      scoped(
        emailSequenceSteps,
        scope,
        inArray(
          emailSequenceSteps.sequenceId,
          sequences.map((s) => s.id),
        ),
      ),
    )
    .orderBy(asc(emailSequenceSteps.position));

  const stepsBySequence = new Map<string, EmailSequenceStep[]>();
  for (const step of steps) {
    const list = stepsBySequence.get(step.sequenceId) ?? [];
    list.push(step);
    stepsBySequence.set(step.sequenceId, list);
  }

  return sequences.map((sequence) => ({ sequence, steps: stepsBySequence.get(sequence.id) ?? [] }));
}

/** Scoped lookup used by lib/email/schedule.ts's retryPendingScheduledEmail
 *  — a pending row only knows its stepId, not which trainer's scope minted
 *  it, so the caller must already hold the right scope before calling this. */
export async function getEmailSequenceStepForSend(
  scope: TrainerScope,
  stepId: string,
): Promise<EmailSequenceStep | null> {
  const [step] = await db
    .select()
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.id, stepId)))
    .limit(1);
  return step ?? null;
}
