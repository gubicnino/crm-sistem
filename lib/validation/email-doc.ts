import { z } from "zod";
import type { EmailDocNode } from "@/db/types";

/** The whole closed set of tokens a step body may interpolate — mirrors
 *  EmailDocVariableName in db/types.ts and lib/email/rich-text.tsx's
 *  resolveVariable. Kept here (not imported from there) so this file has no
 *  dependency beyond zod + the type it validates. */
const EMAIL_DOC_VARIABLE_NAMES = ["leadName", "trainerName"] as const;

/** Hard ceilings — this is the actual security/abuse boundary, not just a
 *  UX nicety. A doc past either limit is rejected outright, never truncated
 *  (truncating silently would let a trainer believe more was saved than
 *  was). */
const MAX_EMAIL_DOC_DEPTH = 10;
const MAX_EMAIL_DOC_CHARS = 20_000;

/** Only these three protocols may ever appear in a link or button href.
 *  `javascript:`, `data:`, `vbscript:`, and bare-relative hrefs are all
 *  rejected — an email client that resolves a relative href against an
 *  attacker-chosen base, or one of the historical script-executing schemes,
 *  is exactly the class of bug a whitelist like this exists to close. */
function isSafeHref(href: string): boolean {
  return /^(https:|http:|mailto:)/i.test(href);
}

const safeHrefSchema = z.string().trim().min(1).max(2000).refine(isSafeHref, {
  error: "Povezava mora uporabljati https, http ali mailto.",
});

const boldMarkSchema = z.object({ type: z.literal("bold") });
const italicMarkSchema = z.object({ type: z.literal("italic") });
const linkMarkSchema = z.object({
  type: z.literal("link"),
  attrs: z.object({ href: safeHrefSchema }),
});

const markSchema = z.union([boldMarkSchema, italicMarkSchema, linkMarkSchema]);

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(MAX_EMAIL_DOC_CHARS),
  marks: z.array(markSchema).max(5).optional(),
});

const variableNodeSchema = z.object({
  type: z.literal("variable"),
  attrs: z.object({ name: z.enum(EMAIL_DOC_VARIABLE_NAMES) }),
});

const hardBreakNodeSchema = z.object({ type: z.literal("hardBreak") });

/** Inline content — what a paragraph, heading, or list item's single
 *  paragraph may contain. */
const inlineNodeSchema = z.union([textNodeSchema, variableNodeSchema, hardBreakNodeSchema]);

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineNodeSchema).max(200).optional(),
});

const headingSchema = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(inlineNodeSchema).max(200).optional(),
});

/**
 * Deliberately just one paragraph, not `block*` like real Tiptap — no
 * nested lists, no multi-paragraph list items. This is a size/complexity
 * cut for Phase 2, not a security one; revisit only if a trainer genuinely
 * needs more structure than one line per bullet.
 */
const listItemSchema = z.object({
  type: z.literal("listItem"),
  content: z.tuple([paragraphSchema]),
});

const bulletListSchema = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItemSchema).min(1).max(50),
});

const orderedListSchema = z.object({
  type: z.literal("orderedList"),
  content: z.array(listItemSchema).min(1).max(50),
});

const ctaButtonSchema = z.object({
  type: z.literal("ctaButton"),
  attrs: z.object({
    href: safeHrefSchema,
    label: z.string().trim().min(1, { error: "Napis na gumbu je obvezen." }).max(100),
  }),
});

const blockNodeSchema = z.union([paragraphSchema, headingSchema, bulletListSchema, orderedListSchema, ctaButtonSchema]);

/**
 * Walks an already-shape-validated tree (Zod has confirmed every node is one
 * of the allowed types) to enforce the two limits Zod's own recursive
 * `z.union`/`z.array` machinery can't express directly: total nesting depth
 * and total interpolatable text length. Both are abuse limits — a
 * pathologically deep or huge document is rejected outright, not truncated.
 */
function measureDoc(node: EmailDocNode, depth: number): { maxDepth: number; chars: number } {
  let maxDepth = depth;
  let chars = node.type === "text" ? (node.text?.length ?? 0) : 0;
  for (const child of node.content ?? []) {
    const childStats = measureDoc(child, depth + 1);
    maxDepth = Math.max(maxDepth, childStats.maxDepth);
    chars += childStats.chars;
  }
  return { maxDepth, chars };
}

export const emailDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(blockNodeSchema).min(1, { error: "Dodajte vsaj en odstavek besedila." }).max(200),
  })
  .refine(
    (doc) => {
      const { maxDepth, chars } = measureDoc(doc as EmailDocNode, 1);
      return maxDepth <= MAX_EMAIL_DOC_DEPTH && chars <= MAX_EMAIL_DOC_CHARS;
    },
    { error: "Vsebina je predolga ali preveč gnezdena." },
  );

export type EmailDocInput = z.infer<typeof emailDocSchema>;
