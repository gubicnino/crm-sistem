import { substituteVariables, type SequenceRenderContext } from "@/lib/email/variables";
import { SequenceEmail } from "@/lib/email/templates/sequence-email";

/** What renderSequenceStep needs from a step — email_sequence_steps rows
 *  (db/schema.ts) satisfy this structurally, extra columns and all. */
export interface RenderableStep {
  subject: string;
  heading: string;
  paragraphs: string[];
}

export function renderSequenceStep(step: RenderableStep, ctx: SequenceRenderContext, unsubscribeLink: string) {
  return {
    subject: substituteVariables(step.subject, ctx),
    react: SequenceEmail({
      heading: substituteVariables(step.heading, ctx),
      paragraphs: step.paragraphs.map((paragraph) => substituteVariables(paragraph, ctx)),
      unsubscribeLink,
    }),
  };
}
