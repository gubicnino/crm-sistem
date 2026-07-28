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
async function main() {
  const [trainerEmail, value] = process.argv.slice(2);
  if (!trainerEmail || !value) {
    console.error('Usage: npm run trainer:set-from -- trainer@example.com "Ime Priimek <ime@sub.domain.com>"');
    console.error("       npm run trainer:set-from -- trainer@example.com --clear");
    process.exit(1);
  }

  const { getTrainerByEmail, setTrainerFromEmail } = await import("../db/queries/trainers");
  const { systemScope } = await import("../lib/tenant");
  const { fromEmailSchema } = await import("../lib/validation/admin");

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

  const parsed = fromEmailSchema.safeParse(value);
  if (!parsed.success) {
    console.error(parsed.error.issues[0]?.message ?? "Invalid value.");
    process.exit(1);
  }

  await setTrainerFromEmail(scope, parsed.data);
  console.log(`Set from-email for ${trainer.name} (${trainerEmail}):`);
  console.log(`  ${parsed.data}`);
  console.log("Make sure that domain is verified in the Resend dashboard, or sends will fail.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
