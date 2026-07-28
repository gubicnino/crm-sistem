import { z } from "zod";

/**
 * Trim + lowercase BEFORE validating email format. `z.email().trim()` does
 * NOT do this — Zod runs checks in the order chained, so the format check
 * baked into z.email() runs before a later .trim()/.toLowerCase(), and
 * whitespace-padded input fails validation before ever being normalized.
 * .pipe() sequences it correctly: normalize first, then validate the result.
 */
export function normalizedEmail(maxLength: number, errorMessage: string) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .max(maxLength)
    .pipe(z.email({ error: errorMessage }));
}
