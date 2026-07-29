import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailBroadcasts, type EmailBroadcast } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import { scoped, type TrainerScope } from "@/lib/tenant";

export interface CreateEmailBroadcastInput {
  /** Client-minted once per compose session — see emailBroadcasts.clientRequestId's
   *  doc in db/schema.ts for why this is the idempotency key, not `id`. */
  clientRequestId: string;
  subject: string;
  body: EmailDocNode;
  scheduledFor: Date;
  /** Snapshot of the recipient count at send time — see
   *  emailBroadcasts.recipientCount's doc in db/schema.ts. */
  recipientCount: number;
}

/**
 * Inserts the broadcast record, or returns the existing one if this exact
 * (trainerId, clientRequestId) pair was already used — makes a resubmitted
 * send (double-click, second tab, retried request) resolve to the SAME
 * broadcast row instead of minting a new one, which is what lets
 * lib/email/broadcast.ts's sendBroadcast derive a truly stable sequenceStep
 * per logical send (security-reviewer finding, Phase 5: deriving it from a
 * freshly-generated id defeated the scheduled_emails unique index).
 *
 * The scheduled_emails rows (one per recipient) are reserved and sent
 * separately by sendBroadcast, which calls this first to get the
 * broadcastId they reference.
 */
export async function getOrCreateEmailBroadcast(
  scope: TrainerScope,
  input: CreateEmailBroadcastInput,
): Promise<EmailBroadcast> {
  const [inserted] = await db
    .insert(emailBroadcasts)
    .values({
      trainerId: scope.trainerId,
      clientRequestId: input.clientRequestId,
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      recipientCount: input.recipientCount,
    })
    .onConflictDoNothing({
      target: [emailBroadcasts.trainerId, emailBroadcasts.clientRequestId],
    })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(emailBroadcasts)
    .where(scoped(emailBroadcasts, scope, eq(emailBroadcasts.clientRequestId, input.clientRequestId)));
  return existing;
}
