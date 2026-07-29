import { describe, expect, it } from "vitest";
import { headingAndParagraphsToDoc } from "@/lib/email/plain-text-to-doc";
import { emailDocSchema } from "@/lib/validation/email-doc";

describe("headingAndParagraphsToDoc", () => {
  it("produces a doc whose first block is a level-2 heading", () => {
    const result = headingAndParagraphsToDoc("Naslov", ["Odstavek."]);
    expect(result.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
  });

  it("produces one paragraph block per input paragraph", () => {
    const result = headingAndParagraphsToDoc("Naslov", ["Prvi.", "Drugi."]);
    expect(result.content).toHaveLength(3); // heading + 2 paragraphs
  });

  it("converts {{ime}} into a leadName variable node", () => {
    const result = headingAndParagraphsToDoc("Naslov", ["Pozdravljeni {{ime}}!"]);
    const paragraph = result.content?.[1];
    const nodeTypes = paragraph?.content?.map((n) => n.type);
    expect(nodeTypes).toContain("variable");
    const variableNode = paragraph?.content?.find((n) => n.type === "variable");
    expect(variableNode?.attrs?.name).toBe("leadName");
  });

  it("converts {{trener}} into a trainerName variable node", () => {
    const result = headingAndParagraphsToDoc("Naslov", ["Lep pozdrav, {{trener}}"]);
    const paragraph = result.content?.[1];
    const variableNode = paragraph?.content?.find((n) => n.type === "variable");
    expect(variableNode?.attrs?.name).toBe("trainerName");
  });

  it("leaves plain text with no tokens as a single text node", () => {
    const result = headingAndParagraphsToDoc("Naslov", ["Navadno besedilo."]);
    const paragraph = result.content?.[1];
    expect(paragraph?.content).toHaveLength(1);
    expect(paragraph?.content?.[0]).toMatchObject({ type: "text", text: "Navadno besedilo." });
  });

  it("produces output that passes emailDocSchema validation", () => {
    const result = headingAndParagraphsToDoc("Hvala za prijavo!", [
      "Vašo prijavo smo uspešno prejeli. {{trener}} si jo bo kmalu ogledal.",
      "Pozdravljeni {{ime}}.",
    ]);
    expect(emailDocSchema.safeParse(result).success).toBe(true);
  });
});
