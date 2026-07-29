import { describe, expect, it } from "vitest";
import { emailSequenceFormSchema, emailSequenceStepSchema } from "@/lib/validation/email-sequences";

const validBody = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] };
const validStep = { subject: "Zadeva", body: validBody, dayOffset: 0 };

describe("emailSequenceStepSchema — sendOnlyIfStage", () => {
  it("accepts a step with no sendOnlyIfStage (unconditional)", () => {
    expect(emailSequenceStepSchema.safeParse(validStep).success).toBe(true);
  });

  it("accepts a step with a non-terminal sendOnlyIfStage list", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, sendOnlyIfStage: ["contacted"] });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null sendOnlyIfStage", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, sendOnlyIfStage: null });
    expect(result.success).toBe(true);
  });

  it("rejects sendOnlyIfStage containing the terminal stage 'client'", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, sendOnlyIfStage: ["contacted", "client"] });
    expect(result.success).toBe(false);
  });

  it("rejects sendOnlyIfStage containing the terminal stage 'lost'", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, sendOnlyIfStage: ["lost"] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown stage string", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, sendOnlyIfStage: ["not_a_real_stage"] });
    expect(result.success).toBe(false);
  });
});

describe("emailSequenceFormSchema — trigger discriminated union", () => {
  const base = { name: "Sekvenca", enabled: true, steps: [validStep] };

  it("accepts a lead_created sequence with a specific triggerSource", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "lead_created", triggerSource: "application" });
    expect(result.success).toBe(true);
  });

  it("accepts a lead_created sequence with a null triggerSource (any source)", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "lead_created", triggerSource: null });
    expect(result.success).toBe(true);
  });

  it("rejects a lead_created sequence missing triggerSource entirely", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "lead_created" });
    expect(result.success).toBe(false);
  });

  it("accepts a stage_entered sequence with a non-terminal triggerStage", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "stage_entered", triggerStage: "contacted" });
    expect(result.success).toBe(true);
  });

  it("rejects a stage_entered sequence whose triggerStage is the terminal 'client'", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "stage_entered", triggerStage: "client" });
    expect(result.success).toBe(false);
  });

  it("rejects a stage_entered sequence whose triggerStage is the terminal 'lost'", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "stage_entered", triggerStage: "lost" });
    expect(result.success).toBe(false);
  });

  it("rejects a stage_entered sequence missing triggerStage entirely", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "stage_entered" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown triggerType", () => {
    const result = emailSequenceFormSchema.safeParse({ ...base, triggerType: "something_else", triggerSource: null });
    expect(result.success).toBe(false);
  });
});
