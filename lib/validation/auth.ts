import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

export const loginSchema = z.object({
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  password: z.string({ error: "Geslo je obvezno." }).min(1),
});

export const redeemInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string({ error: "Ime je obvezno." }).trim().min(1).max(200),
  password: z.string({ error: "Geslo mora imeti vsaj 8 znakov." }).min(8).max(200),
});

export const requestPasswordResetSchema = z.object({
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string({ error: "Geslo mora imeti vsaj 8 znakov." }).min(8).max(200),
});
