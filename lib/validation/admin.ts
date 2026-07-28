import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/**
 * Shared by scripts/set-trainer-from.ts and lib/actions/admin.ts's
 * setTrainerFromEmailAction, so the CLI and the admin UI can never drift on
 * what a valid sender string is.
 */
const FROM_EMAIL_PATTERN = /^.+ <([^<>@\s]+@[^<>@\s]+)>$/;

export const fromEmailSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => FROM_EMAIL_PATTERN.test(value), {
    error: 'Pričakovana oblika: "Ime Priimek <ime@sub.domena.com>"',
  })
  .refine(
    (value) => {
      const match = FROM_EMAIL_PATTERN.exec(value);
      return match !== null && z.email().safeParse(match[1]).success;
    },
    { error: "Naslov znotraj oglatih oklepajev ni veljaven e-poštni naslov." },
  );

export const trainerIdSchema = z.uuid({ error: "Neveljaven ID trenerja." });

export const inviteTrainerSchema = z.object({
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
});
