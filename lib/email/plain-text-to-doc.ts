import type { EmailDocNode, EmailDocVariableName } from "@/db/types";

/** Recognizes Phase 1's plain-text {{ime}}/{{trener}} tokens (see the
 *  now-removed lib/email/variables.ts substituteVariables) and converts
 *  them into proper `variable` nodes. Shared by lib/email/default-sequences.ts
 *  (authoring the seed content) and scripts/backfill-email-doc-bodies.ts
 *  (converting real Phase 1 rows) so both go through the same conversion. */
const TOKEN_TO_VARIABLE: Record<string, EmailDocVariableName> = {
  "{{ime}}": "leadName",
  "{{trener}}": "trainerName",
};
const TOKEN_PATTERN = /(\{\{ime\}\}|\{\{trener\}\})/g;

function textToInlineNodes(text: string): EmailDocNode[] {
  return text
    .split(TOKEN_PATTERN)
    .filter((part) => part.length > 0)
    .map((part): EmailDocNode => {
      const variableName = TOKEN_TO_VARIABLE[part];
      return variableName ? { type: "variable", attrs: { name: variableName } } : { type: "text", text: part };
    });
}

/** Builds a body EmailDoc equivalent to Phase 1's `heading: string` +
 *  `paragraphs: string[]` — a level-2 heading followed by one paragraph
 *  per string, each with {{ime}}/{{trener}} tokens converted to variable
 *  nodes. */
export function headingAndParagraphsToDoc(heading: string, paragraphs: string[]): EmailDocNode {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: textToInlineNodes(heading) },
      ...paragraphs.map((paragraph): EmailDocNode => ({ type: "paragraph", content: textToInlineNodes(paragraph) })),
    ],
  };
}
