import { mergeAttributes, Node } from "@tiptap/core";
import type { EmailDocVariableName } from "@/db/types";

/** In-editor label shown for a `variable` node's chip — kept here (not
 *  imported from lib/email/rich-text.tsx, which resolves the actual value
 *  at send time) since this is purely editor-display, never sent. */
const VARIABLE_LABELS: Record<EmailDocVariableName, string> = {
  leadName: "Ime stranke",
  trainerName: "Ime trenerja",
};

/**
 * Editor-only representation of an EmailDoc `variable` node (see
 * db/types.ts and lib/validation/email-doc.ts) — an inline atom chip the
 * trainer inserts via the toolbar (see components/emails/rich-text-editor.tsx),
 * never typed as raw text. `getJSON()` on this node produces exactly
 * `{ type: "variable", attrs: { name } }`, which is what emailDocSchema and
 * lib/email/rich-text.tsx expect.
 */
export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: { default: "leadName" as EmailDocVariableName },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ node }) {
    const name = node.attrs.name as EmailDocVariableName;
    return [
      "span",
      mergeAttributes({ "data-variable": name, class: "email-variable-chip" }),
      VARIABLE_LABELS[name] ?? name,
    ];
  },
});

/**
 * Editor-only representation of an EmailDoc `ctaButton` node — a block-level
 * atom (like an image node), inserted via the toolbar with its href/label
 * supplied through prompts rather than edited inline. See
 * lib/email/rich-text.tsx's renderBlockNode for how it renders in the real
 * sent email (a react-email <Button>, not this in-editor chip).
 */
export const CtaButton = Node.create({
  name: "ctaButton",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      href: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-cta-button]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({ "data-cta-button": "true", class: "email-cta-chip" }),
      `🔘 ${node.attrs.label || "Gumb"}`,
    ];
  },
});
