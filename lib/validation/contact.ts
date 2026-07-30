import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/** The public landing-page contact form contract — UI-only for now, see
 *  docs/superpowers/specs/2026-07-30-public-landing-page-design.md. */
export const contactSchema = z.object({
  name: z.string().trim().min(1, "Vnesite ime.").max(200),
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  message: z.string().trim().min(1, "Vnesite sporočilo.").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
