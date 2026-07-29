import { config } from "dotenv";

// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

/**
 * One-off backfill for trainers created before Phase 1's email-sequences
 * feature shipped — gives each of them the same two starter sequences a
 * newly registered trainer gets automatically (see lib/actions/auth.ts).
 * Idempotent: skips any trainer who already has at least one sequence row,
 * so re-running this after the fact is a safe no-op.
 */
async function main() {
  const { db } = await import("../db");
  const { trainers, emailSequences } = await import("../db/schema");
  const { seedDefaultSequencesForTrainer } = await import("../lib/email/seed-defaults");
  const { systemScope } = await import("../lib/tenant");

  const allTrainers = await db.select().from(trainers);
  const existingSequenceTrainerIds = await db
    .select({ trainerId: emailSequences.trainerId })
    .from(emailSequences);
  const alreadySeeded = new Set(existingSequenceTrainerIds.map((row) => row.trainerId));

  let seeded = 0;
  for (const trainer of allTrainers) {
    if (alreadySeeded.has(trainer.id)) continue;
    await seedDefaultSequencesForTrainer(systemScope(trainer.id, "operator_cli"));
    seeded++;
    console.log(`Seeded default sequences for ${trainer.name} (${trainer.id}).`);
  }
  console.log(`Done. Seeded ${seeded} trainer(s); ${allTrainers.length - seeded} already had sequences.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
