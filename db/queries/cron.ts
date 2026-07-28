import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { cronRuns, invites, passwordResetTokens, rateLimit } from "@/db/schema";
import type { CronRunStats, CronRunStatus } from "@/db/types";

/**
 * The idempotency primitive for the whole cron run: the unique `run_date`
 * makes a second same-day trigger a structurally safe no-op — no flags, no
 * "within N hours" heuristics. Returns false if today's run already exists.
 */
export async function startCronRunIfNotAlreadyRun(runDate: Date): Promise<boolean> {
  const [run] = await db
    .insert(cronRuns)
    .values({ runDate, status: "running" })
    .onConflictDoNothing({ target: cronRuns.runDate })
    .returning();
  return !!run;
}

export async function finishCronRun(runDate: Date, status: CronRunStatus, stats: CronRunStats): Promise<void> {
  await db
    .update(cronRuns)
    .set({ finishedAt: new Date(), status, stats })
    .where(eq(cronRuns.runDate, runDate));
}

export interface CleanupStats {
  rateLimitDeleted: number;
  invitesDeleted: number;
  passwordResetTokensDeleted: number;
  cronRunsDeleted: number;
}

/** Housekeeping only — deletes rows with no ongoing purpose. Nothing here
 *  touches tenant-owned data, so no TrainerScope is needed. */
export async function cleanupExpiredRows(): Promise<CleanupStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const rateLimitRows = await db
    .delete(rateLimit)
    .where(lt(rateLimit.windowStart, sevenDaysAgo))
    .returning({ id: rateLimit.id });
  const inviteRows = await db.delete(invites).where(lt(invites.expiresAt, now)).returning({ id: invites.id });
  const tokenRows = await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, now))
    .returning({ id: passwordResetTokens.id });
  const cronRunRows = await db
    .delete(cronRuns)
    .where(lt(cronRuns.runDate, ninetyDaysAgo))
    .returning({ id: cronRuns.id });

  return {
    rateLimitDeleted: rateLimitRows.length,
    invitesDeleted: inviteRows.length,
    passwordResetTokensDeleted: tokenRows.length,
    cronRunsDeleted: cronRunRows.length,
  };
}
