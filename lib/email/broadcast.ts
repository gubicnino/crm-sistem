import { createEmailBroadcast } from "@/db/queries/email-broadcasts";
import { listLeadsByIds } from "@/db/queries/leads";
import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { EmailDoc } from "@/db/types";
import { FROM_EMAIL } from "@/lib/email/client";
import { IMMEDIATE_SEND_DELAY_SECONDS } from "@/lib/email/constants";
import { sendReservedStep } from "@/lib/email/schedule";
import type { SequenceRenderContext } from "@/lib/email/variables";
import { isTerminalStage } from "@/lib/pipeline";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

export interface SendBroadcastInput {
  subject: string;
  body: EmailDoc;
  leadIds: string[];
  /** null means "send now" — same IMMEDIATE_SEND_DELAY_SECONDS window a
   *  sequence's day-0 step uses (a real, if brief, cancellation window). */
  scheduledFor: Date | null;
}

export interface SendBroadcastResult {
  broadcastId: string;
  /** How many rows were actually reserved and sent. */
  recipientCount: number;
  /** Selected leadIds that were dropped: not owned by this trainer,
   *  unsubscribed, or at a terminal stage (client/lost). Server-side, not
   *  just a UI filter — a client could submit a stale selection. */
  skippedCount: number;
}

/**
 * The trainer's one-off manual send (Phase 5). Mirrors the reserve->send
 * protocol every other email path in this codebase uses (lib/email/schedule.ts),
 * with `kind: "broadcast"` and `sequenceStep: "broadcast:<broadcastId>"` so
 * the existing (leadId, sequenceStep, attempt) unique index still makes a
 * re-submitted request idempotent per lead, and so the row is cancelable
 * through the exact same path as a sequence step (CLAUDE.md: "Cancellation
 * is mandatory").
 *
 * Hard-excludes unsubscribed and terminal-stage leads regardless of what
 * the trainer's checkbox selection contained — this can't be left to the
 * UI alone, since the leadIds arrive as plain client input.
 */
export async function sendBroadcast(scope: TrainerScope, input: SendBroadcastInput): Promise<SendBroadcastResult> {
  const found = await listLeadsByIds(scope, input.leadIds);
  const eligible = found.filter((lead) => !lead.unsubscribedAt && !isTerminalStage(lead.stage));
  const skippedCount = input.leadIds.length - eligible.length;

  const scheduledFor = input.scheduledFor ?? new Date(Date.now() + IMMEDIATE_SEND_DELAY_SECONDS * 1000);

  const broadcast = await createEmailBroadcast(scope, {
    subject: input.subject,
    body: input.body,
    scheduledFor,
    recipientCount: eligible.length,
  });

  if (eligible.length === 0) {
    return { broadcastId: broadcast.id, recipientCount: 0, skippedCount };
  }

  const trainer = await getTrainer(scope);
  const from = trainer?.fromEmail ?? FROM_EMAIL;
  const trainerName = trainer?.name ?? "";
  const sequenceStep = `broadcast:${broadcast.id}`;

  let recipientCount = 0;
  for (const lead of eligible) {
    const [reserved] = await reserveScheduledEmails(scope, [
      {
        leadId: lead.id,
        sequenceStep,
        stepId: null,
        broadcastId: broadcast.id,
        kind: "broadcast",
        scheduledFor,
      },
    ]);
    if (!reserved) continue; // already sent this broadcast to this lead — idempotent no-op

    const ctx: SequenceRenderContext = { leadName: lead.name, trainerName };
    const link = unsubscribeLink(lead.id);
    await sendReservedStep(reserved, { subject: input.subject, body: input.body }, ctx, link, lead.email, from, scheduledFor.toISOString());
    recipientCount++;
  }

  return { broadcastId: broadcast.id, recipientCount, skippedCount };
}
