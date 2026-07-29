import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EmailDocNode } from "@/db/types";
import { renderEmailDocBody } from "@/lib/email/rich-text";

const ctx = { leadName: "Ana", trainerName: "Janez" };

function html(node: EmailDocNode): string {
  const nodes = renderEmailDocBody(node, ctx);
  return renderToStaticMarkup(createElement("div", null, ...nodes));
}

function doc(content: EmailDocNode[]): EmailDocNode {
  return { type: "doc", content };
}

describe("renderEmailDocBody", () => {
  it("renders a paragraph's plain text", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "text", text: "Pozdravljeni." }] }]));
    expect(out).toContain("Pozdravljeni.");
  });

  it("renders a heading at the requested level", () => {
    const out = html(doc([{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Naslov" }] }]));
    expect(out).toContain("<h3");
    expect(out).toContain("Naslov");
  });

  it("wraps bold text in <strong>", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "text", text: "krepko", marks: [{ type: "bold" }] }] }]));
    expect(out).toContain("<strong");
    expect(out).toContain("krepko");
  });

  it("wraps italic text in <em>", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "text", text: "ležeče", marks: [{ type: "italic" }] }] }]));
    expect(out).toContain("<em");
  });

  it("renders a link mark as an anchor with the given href", () => {
    const out = html(
      doc([
        {
          type: "paragraph",
          content: [{ type: "text", text: "tukaj", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }],
        },
      ]),
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain("tukaj");
  });

  it("resolves the leadName variable to the lead's name", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "variable", attrs: { name: "leadName" } }] }]));
    expect(out).toContain("Ana");
  });

  it("resolves the trainerName variable to the trainer's name", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "variable", attrs: { name: "trainerName" } }] }]));
    expect(out).toContain("Janez");
  });

  it("resolves leadName to an empty string when the lead has no name", () => {
    const nodes = renderEmailDocBody(
      doc([{ type: "paragraph", content: [{ type: "variable", attrs: { name: "leadName" } }] }]),
      { leadName: null, trainerName: "Janez" },
    );
    const out = renderToStaticMarkup(createElement("div", null, ...nodes));
    expect(out).not.toContain("null");
    expect(out).not.toContain("undefined");
  });

  it("renders a hardBreak as <br>", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] }]));
    expect(out).toContain("<br");
  });

  it("renders bullet list items with a bullet marker", () => {
    const out = html(
      doc([
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Prva" }] }] }],
        },
      ]),
    );
    expect(out).toContain("Prva");
    expect(out).toContain("•");
  });

  it("renders ordered list items with a numeric marker", () => {
    const out = html(
      doc([
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Prvi korak" }] }] }],
        },
      ]),
    );
    expect(out).toContain("Prvi korak");
    expect(out).toContain("1.");
  });

  it("renders a ctaButton as a link with its label and href", () => {
    const out = html(doc([{ type: "ctaButton", attrs: { href: "https://example.com/book", label: "Rezervirajte" } }]));
    expect(out).toContain('href="https://example.com/book"');
    expect(out).toContain("Rezervirajte");
  });

  it("silently skips an unrecognized block node type instead of throwing", () => {
    expect(() => html(doc([{ type: "notARealType" } as unknown as EmailDocNode]))).not.toThrow();
    const out = html(doc([{ type: "notARealType" } as unknown as EmailDocNode]));
    expect(out).toBe("<div></div>");
  });

  it("silently skips an unrecognized inline node type instead of throwing", () => {
    const out = html(doc([{ type: "paragraph", content: [{ type: "notARealType" } as unknown as EmailDocNode] }]));
    expect(out).not.toContain("notARealType");
  });
});
