export interface SequenceRenderContext {
  leadName: string | null;
  trainerName: string;
}

/**
 * The trainer's two supported placeholder tokens, in the order they're
 * applied. A fixed, closed set — not a generic template engine — so a
 * trainer typing literal `{{` in prose can't accidentally reference
 * anything we didn't intend to expose. Phase 2's rich-text `variable` node
 * (lib/validation/email-doc.ts) replaces this same closed set with a proper
 * editor affordance instead of raw token typing.
 */
const VARIABLE_RESOLVERS: Record<string, (ctx: SequenceRenderContext) => string> = {
  "{{ime}}": (ctx) => ctx.leadName ?? "",
  "{{trener}}": (ctx) => ctx.trainerName,
};

export function substituteVariables(text: string, ctx: SequenceRenderContext): string {
  let result = text;
  for (const [token, resolve] of Object.entries(VARIABLE_RESOLVERS)) {
    result = result.split(token).join(resolve(ctx));
  }
  return result;
}
