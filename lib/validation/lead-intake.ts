import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/**
 * The public POST /api/leads payload contract. Per CLAUDE.md, this is a
 * versioned external contract — a breaking change here means a new
 * /api/v1/leads route, not silently altering this shape.
 *
 * `answers` is deliberately permissive on keys: shape and size are validated,
 * but unknown keys are accepted rather than rejected. The trainer's site is an
 * independently deployed build; hard-rejecting keys that no longer match the
 * trainer's current applicationQuestions would silently break lead capture
 * after every question edit on this side.
 */

const answerValue = z.union([
  z.string().max(2000),
  z.array(z.string().max(2000)).max(50),
  z.number(),
  z.boolean(),
]);

const answers = z
  .record(z.string().max(64), answerValue)
  .refine((obj) => Object.keys(obj).length <= 40, { error: "Preveč odgovorov v prijavi." });

export const leadIntakeSchema = z.object({
  siteKey: z.string().min(1).max(128),
  source: z.enum(["application", "lead_magnet"]),
  name: z.string().trim().min(1).max(200).optional(),
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  phone: z.string().trim().max(50).optional(),
  answers: answers.optional(),
  /** Honeypot — humans never see or fill this field. */
  website: z.string().max(500).optional(),
});

export type LeadIntakeInput = z.infer<typeof leadIntakeSchema>;
