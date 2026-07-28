import type { SequenceContext, SequenceStep } from "@/lib/email/sequences";
import { SequenceEmail } from "@/lib/email/templates/sequence-email";

export function renderSequenceStep(step: SequenceStep, ctx: SequenceContext, unsubscribeLink: string) {
  return {
    subject: step.subject(ctx),
    react: SequenceEmail({ template: step.template, unsubscribeLink, ...ctx }),
  };
}
