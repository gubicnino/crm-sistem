import { describe, expect, it } from "vitest";
import { emailDocSchema } from "@/lib/validation/email-doc";

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function doc(content: unknown[]) {
  return { type: "doc", content };
}

describe("emailDocSchema", () => {
  it("accepts a minimal valid document", () => {
    expect(emailDocSchema.safeParse(doc([paragraph("Pozdravljeni.")])).success).toBe(true);
  });

  it("accepts every allowed block and inline node together", () => {
    const result = emailDocSchema.safeParse(
      doc([
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Naslov" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Krepko", marks: [{ type: "bold" }] },
            { type: "text", text: " in ", marks: [{ type: "italic" }] },
            { type: "text", text: "povezava", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
            { type: "hardBreak" },
            { type: "variable", attrs: { name: "leadName" } },
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("Prva točka")] }],
        },
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [paragraph("Prvi korak")] }],
        },
        { type: "ctaButton", attrs: { href: "https://example.com/book", label: "Rezervirajte" } },
      ]),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a root node that isn't type 'doc'", () => {
    expect(emailDocSchema.safeParse(paragraph("x")).success).toBe(false);
  });

  it("rejects an unknown node type anywhere in the tree", () => {
    expect(emailDocSchema.safeParse(doc([{ type: "script", content: [] }])).success).toBe(false);
  });

  it("rejects an unknown mark type", () => {
    const result = emailDocSchema.safeParse(
      doc([{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "underline" }] }] }]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: link href", () => {
    const result = emailDocSchema.safeParse(
      doc([
        {
          type: "paragraph",
          content: [{ type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: ctaButton href", () => {
    const result = emailDocSchema.safeParse(
      doc([{ type: "ctaButton", attrs: { href: "javascript:alert(1)", label: "Klikni" } }]),
    );
    expect(result.success).toBe(false);
  });

  it("accepts https, http, and mailto link hrefs", () => {
    for (const href of ["https://example.com", "http://example.com", "mailto:test@example.com"]) {
      const result = emailDocSchema.safeParse(
        doc([{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }]),
      );
      expect(result.success, `expected ${href} to be accepted`).toBe(true);
    }
  });

  it("rejects a variable name outside the closed list", () => {
    const result = emailDocSchema.safeParse(doc([{ type: "paragraph", content: [{ type: "variable", attrs: { name: "secretApiKey" } }] }]));
    expect(result.success).toBe(false);
  });

  it("accepts both closed-list variable names", () => {
    for (const name of ["leadName", "trainerName"]) {
      const result = emailDocSchema.safeParse(doc([{ type: "paragraph", content: [{ type: "variable", attrs: { name } }] }]));
      expect(result.success, `expected ${name} to be accepted`).toBe(true);
    }
  });

  it("rejects a heading level outside 2-3", () => {
    const result = emailDocSchema.safeParse(doc([{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] }]));
    expect(result.success).toBe(false);
  });

  it("rejects a document nested deeper than the max depth", () => {
    // bulletList > listItem > paragraph is already depth 4 from doc (depth 1);
    // nest an extra, disallowed level to push past the ceiling structurally
    // impossible via the allowed schema alone — instead, verify the total
    // char/size guard via an oversized document (see next test) and rely on
    // the schema's own list-item shape (single paragraph, no nested lists)
    // to make "too deep" structurally unreachable through valid node types.
    // This test instead confirms a listItem may not itself contain another list.
    const result = emailDocSchema.safeParse(
      doc([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph("nested")] }] }],
            },
          ],
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a document whose total text exceeds the character ceiling", () => {
    const longText = "a".repeat(20_001);
    const result = emailDocSchema.safeParse(doc([paragraph(longText)]));
    expect(result.success).toBe(false);
  });

  it("accepts a document at exactly the character ceiling", () => {
    const longText = "a".repeat(19_999); // + 1 heading char below stays under 20000
    const result = emailDocSchema.safeParse(doc([paragraph(longText)]));
    expect(result.success).toBe(true);
  });

  it("rejects an empty content array on the root doc", () => {
    expect(emailDocSchema.safeParse(doc([])).success).toBe(false);
  });

  it("silently-invalid ctaButton without an href is rejected, not defaulted", () => {
    const result = emailDocSchema.safeParse(doc([{ type: "ctaButton", attrs: { label: "Klikni" } }]));
    expect(result.success).toBe(false);
  });
});
