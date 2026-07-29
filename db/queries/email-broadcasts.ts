import { db } from "@/db";
import { emailBroadcasts, type EmailBroadcast } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import type { TrainerScope } from "@/lib/tenant";

export interface CreateEmailBroadcastInput {
  subject: string;
  body: EmailDocNode;
  scheduledFor: Date;
  /** Snapshot of the recipient count at send time — see
   *  emailBroadcasts.recipientCount's doc in db/schema.ts. */
  recipientCount: number;
}

/** Inserts the broadcast record itself. The scheduled_emails rows (one per
 *  recipient) are reserved and sent separately by lib/email/broadcast.ts's
 *  sendBroadcast, which calls this first to get the broadcastId they
 *  reference. */
export async function createEmailBroadcast(
  scope: TrainerScope,
  input: CreateEmailBroadcastInput,
): Promise<EmailBroadcast> {
  const [broadcast] = await db
    .insert(emailBroadcasts)
    .values({
      trainerId: scope.trainerId,
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      recipientCount: input.recipientCount,
    })
    .returning();
  return broadcast;
}
