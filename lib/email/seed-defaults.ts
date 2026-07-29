import { createEmailSequence } from "@/db/queries/email-sequences";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import type { TrainerScope } from "@/lib/tenant";

/**
 * Gives a brand-new trainer the same two starter sequences the product
 * shipped with before Phase 1 (lib/email/default-sequences.ts), so a
 * trainer who never opens /emails/sequences still gets the fast
 * application-confirmation flow and the lead-magnet nurture sequence.
 * Called once, at trainer creation — see lib/actions/auth.ts's
 * redeemInviteAction — and by scripts/seed-default-sequences.ts's one-off
 * backfill for trainers that predate this feature.
 */
export async function seedDefaultSequencesForTrainer(scope: TrainerScope): Promise<void> {
  for (const sequence of DEFAULT_SEQUENCES) {
    await createEmailSequence(scope, {
      name: sequence.name,
      triggerSource: sequence.triggerSource,
      enabled: true,
      steps: sequence.steps,
    });
  }
}
