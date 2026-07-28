import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/** The manually-added-lead / edit-lead form contract — distinct from
 *  lib/validation/lead-intake.ts, which is the public API contract. */
export const manualLeadSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  phone: z.string().trim().max(50).optional(),
});

export type ManualLeadInput = z.infer<typeof manualLeadSchema>;
