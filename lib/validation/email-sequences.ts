import { z } from "zod";
import { pipelineStageEnum } from "@/db/schema";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { isTerminalStage } from "@/lib/pipeline";
import { emailDocSchema } from "@/lib/validation/email-doc";

/**
 * `id` is present when the trainer is editing a step that already exists in
 * the DB (echoed back by the client), and absent for a step just added in
 * this edit session — db/queries/email-sequences.ts's updateEmailSequence
 * uses its presence/absence to decide "update in place" vs. "insert new".
 * `body` is validated by emailDocSchema — see that file's header comment
 * for why this is the actual security boundary for rich-text content, not
 * just a shape check.
 *
 * `sendOnlyIfStage` (Phase 3): null/absent = unconditional (Phase 1/2
 * behavior). Non-null must exclude `client`/`lost` — a step conditioned on
 * a terminal stage would compete with the mandatory cancel-on-terminal that
 * already fires on that same transition (see db/queries/leads.ts's
 * setLeadStage and CLAUDE.md's "Follow-up emails" section).
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
  sendOnlyIfStage: z
    .array(z.enum(pipelineStageEnum.enumValues))
    .max(pipelineStageEnum.enumValues.length)
    .nullable()
    .optional()
    .refine((stages) => !stages || stages.every((stage) => !isTerminalStage(stage)), {
      error: "Pogoja ni mogoče vezati na fazo Stranka ali Izgubljen.",
    }),
});

const sequenceBaseFields = {
  name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
  enabled: z.boolean(),
  steps: z
    .array(emailSequenceStepSchema)
    .min(1, { error: "Sekvenca potrebuje vsaj en korak." })
    .max(MAX_STEPS_PER_SEQUENCE, { error: `Sekvenca ima lahko največ ${MAX_STEPS_PER_SEQUENCE} korakov.` }),
};

/**
 * Two trigger shapes, matching email_sequences.triggerType — a sequence
 * either enrolls a lead on creation (optionally filtered by source) or on
 * entering a specific stage. `triggerStage` excludes `client`/`lost` for
 * the same reason `sendOnlyIfStage` does above: those transitions already
 * have a mandatory, competing action (cancellation).
 */
export const emailSequenceFormSchema = z.discriminatedUnion("triggerType", [
  z.object({
    triggerType: z.literal("lead_created"),
    /** Null = enrolls a lead regardless of source. */
    triggerSource: z.enum(["application", "lead_magnet"]).nullable(),
    ...sequenceBaseFields,
  }),
  z.object({
    triggerType: z.literal("stage_entered"),
    triggerStage: z
      .enum(pipelineStageEnum.enumValues)
      .refine((stage) => !isTerminalStage(stage), { error: "Sekvence ni mogoče sprožiti ob vstopu v to fazo." }),
    ...sequenceBaseFields,
  }),
]);

export type EmailSequenceStepInput = z.infer<typeof emailSequenceStepSchema>;
export type EmailSequenceFormInput = z.infer<typeof emailSequenceFormSchema>;
