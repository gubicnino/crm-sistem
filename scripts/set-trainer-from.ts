import { config } from "dotenv";
// npm run trainer:set-from -- trener@example.com "Janez Novak <janez@sub.domena.com>"
// npm run trainer:set-from -- trener@example.com --clear   # nazaj na globalni RESEND_FROM_EMAIL
// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

/**
 * Only sets the DB override — it does not verify anything with Resend.
 * The from-address's domain must already be verified in the Resend dashboard
 * by the operator before this override takes effect, or sends will fail.
 */
const FROM_EMAIL_PATTERN = /^.+ <([^<>@\s]+@[^<>@\s]+)>$/;

async function main() {
  const [trainerEmail, value] = process.argv.slice(2);
  if (!trainerEmail || !value) {
    console.error('Usage: npm run trainer:set-from -- trainer@example.com "Ime Priimek <ime@sub.domain.com>"');
    console.error("       npm run trainer:set-from -- trainer@example.com --clear");
    process.exit(1);
  }

  const { z } = await import("zod");
  const { getTrainerByEmail, setTrainerFromEmail } = await import("../db/queries/trainers");
  const { systemScope } = await import("../lib/tenant");

  const trainer = await getTrainerByEmail(trainerEmail);
  if (!trainer) {
    console.error(`No trainer found with login email ${trainerEmail}.`);
    process.exit(1);
  }
  const scope = systemScope(trainer.id, "operator_cli");

  if (value === "--clear") {
    await setTrainerFromEmail(scope, null);
    console.log(`Cleared the from-email override for ${trainer.name} — sequence emails now use RESEND_FROM_EMAIL.`);
    return;
  }

  const match = FROM_EMAIL_PATTERN.exec(value);
  if (!match) {
    console.error('Expected the format: "Ime Priimek <ime@sub.domain.com>"');
    process.exit(1);
  }
  const emailCheck = z.email().safeParse(match[1]);
  if (!emailCheck.success) {
    console.error(`"${match[1]}" is not a valid email address.`);
    process.exit(1);
  }

  await setTrainerFromEmail(scope, value);
  console.log(`Set from-email for ${trainer.name} (${trainerEmail}):`);
  console.log(`  ${value}`);
  console.log("Make sure that domain is verified in the Resend dashboard, or sends will fail.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
