import { z } from "zod";
import { MAX_BROADCAST_RECIPIENTS, MAX_SCHEDULE_DAYS } from "@/lib/email/constants";
import { emailDocSchema } from "@/lib/validation/email-doc";

/**
 * The trainer's one-off manual send (Phase 5). `leadIds` are the trainer's
 * explicit checkbox selection — see components/emails/broadcast-form.tsx;
 * the send engine (lib/email/broadcast.ts) still hard-excludes any selected
 * lead who has unsubscribed or reached a terminal stage, since a client
 * could in principle submit a stale selection.
 *
 * `scheduledFor: null` means "send now" (well, the same
 * IMMEDIATE_SEND_DELAY_SECONDS window every sequence step's day-0 send
 * uses, for the same reason: a real, if brief, cancellation window). A
 * non-null value must be within Resend's MAX_SCHEDULE_DAYS ceiling, same as
 * a sequence step's dayOffset.
 */
export const broadcastFormSchema = z.object({
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  body: emailDocSchema,
  leadIds: z
    .array(z.uuid())
    .min(1, { error: "Izberite vsaj eno stranko." })
    .max(MAX_BROADCAST_RECIPIENTS, { error: `Naenkrat lahko izberete največ ${MAX_BROADCAST_RECIPIENTS} strank.` }),
  scheduledFor: z
    .coerce.date()
    .nullable()
    .refine(
      (date) => !date || date.getTime() <= Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000,
      { error: `Datum ne sme biti več kot ${MAX_SCHEDULE_DAYS} dni v prihodnosti (Resendova omejitev).` },
    ),
});

export type BroadcastFormInput = z.infer<typeof broadcastFormSchema>;
