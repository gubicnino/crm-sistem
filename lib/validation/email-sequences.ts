import { z } from "zod";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { emailDocSchema } from "@/lib/validation/email-doc";

/**
 * `id` is present when the trainer is editing a step that already exists in
 * the DB (echoed back by the client), and absent for a step just added in
 * this edit session — db/queries/email-sequences.ts's updateEmailSequence
 * uses its presence/absence to decide "update in place" vs. "insert new".
 * `body` is validated by emailDocSchema — see that file's header comment
 * for why this is the actual security boundary for rich-text content, not
 * just a shape check.
 */
export const emailSequenceStepSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  body: emailDocSchema,
  dayOffset: z
    .number()
    .int()
    .min(0, { error: "Dan mora biti 0 ali več." })
    .max(MAX_SCHEDULE_DAYS, { error: `Dan ne sme biti večji od ${MAX_SCHEDULE_DAYS} (Resendova omejitev).` }),
});

export const emailSequenceFormSchema = z.object({
  name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
  /** Null = enrolls a lead regardless of source. */
  triggerSource: z.enum(["application", "lead_magnet"]).nullable(),
  enabled: z.boolean(),
  steps: z
    .array(emailSequenceStepSchema)
    .min(1, { error: "Sekvenca potrebuje vsaj en korak." })
    .max(MAX_STEPS_PER_SEQUENCE, { error: `Sekvenca ima lahko največ ${MAX_STEPS_PER_SEQUENCE} korakov.` }),
});

export type EmailSequenceStepInput = z.infer<typeof emailSequenceStepSchema>;
export type EmailSequenceFormInput = z.infer<typeof emailSequenceFormSchema>;
