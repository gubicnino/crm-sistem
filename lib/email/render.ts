import type { EmailDocNode } from "@/db/types";
import { renderEmailDocBody } from "@/lib/email/rich-text";
import { substituteVariables, type SequenceRenderContext } from "@/lib/email/variables";
import { SequenceEmail } from "@/lib/email/templates/sequence-email";

/** What renderSequenceStep needs from a step — email_sequence_steps rows
 *  (db/schema.ts) satisfy this structurally, extra columns and all. Subject
 *  stays a plain string with {{ime}}/{{trener}} tokens (an email Subject
 *  header is plain text — rich formatting there wouldn't render on any
 *  client); `body` is the rich-text document rendered by
 *  lib/email/rich-text.tsx. */
export interface RenderableStep {
  subject: string;
  body: EmailDocNode;
}

export function renderSequenceStep(step: RenderableStep, ctx: SequenceRenderContext, unsubscribeLink: string) {
  return {
    subject: substituteVariables(step.subject, ctx),
    react: SequenceEmail({
      bodyNodes: renderEmailDocBody(step.body, ctx),
      unsubscribeLink,
    }),
  };
}
