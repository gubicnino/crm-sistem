import { config } from "dotenv";

// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

/**
 * One-off data migration: converts every email_sequence_steps row's Phase 1
 * heading+paragraphs into a Phase 2 body (EmailDoc), via the same
 * headingAndParagraphsToDoc helper lib/email/default-sequences.ts uses for
 * seed content. Run this once, after the migration that adds the nullable
 * `body` column and before the follow-up migration that drops
 * heading/paragraphs and makes `body` NOT NULL — see db/schema.ts's comment
 * on those columns.
 */
async function main() {
  const { db } = await import("../db");
  const { emailSequenceSteps } = await import("../db/schema");
  const { eq, isNull } = await import("drizzle-orm");
  const { headingAndParagraphsToDoc } = await import("../lib/email/plain-text-to-doc");

  const rows = await db.select().from(emailSequenceSteps).where(isNull(emailSequenceSteps.body));

  for (const row of rows) {
    const body = headingAndParagraphsToDoc(row.heading ?? "", row.paragraphs ?? []);
    await db.update(emailSequenceSteps).set({ body }).where(eq(emailSequenceSteps.id, row.id));
    console.log(`Backfilled step ${row.id} ("${row.heading}").`);
  }

  console.log(`Done. Backfilled ${rows.length} step(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
