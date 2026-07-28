import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainers, type Trainer } from "@/db/schema";
import type { ApplicationQuestion } from "@/db/types";
import { type TrainerScope } from "@/lib/tenant";

/**
 * Unscoped by necessity: this is how a TrainerScope's trainerId is first
 * resolved, from an authenticated userId, inside lib/auth.ts's jwt callback.
 * Never call this from anywhere that already has (or should have) a scope.
 */
export async function getTrainerByUserId(userId: string): Promise<Trainer | null> {
  const [trainer] = await db.select().from(trainers).where(eq(trainers.userId, userId)).limit(1);
  return trainer ?? null;
}

/** trainers.id IS the scope id, so this checks equality directly rather than
 *  via ownedBy() — ownedBy is for tables owned by a trainer, not the trainer row itself. */
export async function getTrainer(scope: TrainerScope): Promise<Trainer | null> {
  const [trainer] = await db.select().from(trainers).where(eq(trainers.id, scope.trainerId)).limit(1);
  return trainer ?? null;
}

/**
 * Unscoped by necessity: this is how the public /api/leads and form-config
 * endpoints resolve a trainer from a caller-supplied site_key, before a
 * TrainerScope can exist. A miss must be treated as "not found" by the
 * caller and answered identically to a valid-but-quiet request — never a 404
 * — so this endpoint can't be used to enumerate valid site keys.
 */
export async function getTrainerBySiteKey(siteKey: string): Promise<Trainer | null> {
  const [trainer] = await db.select().from(trainers).where(eq(trainers.siteKey, siteKey)).limit(1);
  return trainer ?? null;
}

/** Cross-tenant by necessity: the cron digest task iterates every trainer
 *  who wants a daily email. */
export async function listTrainersWithDigestEnabled(): Promise<Trainer[]> {
  return db.select().from(trainers).where(eq(trainers.digestEnabled, true));
}

export async function updateApplicationQuestions(
  scope: TrainerScope,
  questions: ApplicationQuestion[],
): Promise<Trainer> {
  const [updated] = await db
    .update(trainers)
    .set({ applicationQuestions: questions })
    .where(eq(trainers.id, scope.trainerId))
    .returning();
  if (!updated) {
    throw new Error("Trainer not found.");
  }
  return updated;
}
