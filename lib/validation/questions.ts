import { z } from "zod";

/**
 * Shared with the public ingest side (lead answers are keyed by these ids —
 * see lib/validation/lead-intake.ts). Changing an existing question's id
 * would orphan historical leads.answers keys, so once a question exists the
 * UI disables editing its id — label, options, required, and deletion remain
 * editable. This schema itself just validates a fresh array; the
 * immutability rule is enforced in components/settings/questions-editor.tsx.
 */
export const questionIdSchema = z
  .string()
  .regex(/^[a-z0-9_]{1,64}$/, {
    error: "ID sme vsebovati le male črke, številke in podčrtaj (največ 64 znakov).",
  });

export const applicationQuestionSchema = z.object({
  id: questionIdSchema,
  label: z.string().trim().min(1, { error: "Naslov vprašanja je obvezen." }).max(200),
  type: z.enum(["text", "textarea", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

export const applicationQuestionsSchema = z
  .array(applicationQuestionSchema)
  .max(40)
  .refine((questions) => new Set(questions.map((q) => q.id)).size === questions.length, {
    error: "ID vprašanj morajo biti edinstveni.",
  });
