import { describe, expect, it } from "vitest";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { emailSequenceFormSchema, emailSequenceStepSchema } from "@/lib/validation/email-sequences";

const validStep = {
  subject: "Prejeli smo vašo prijavo",
  body: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hvala za prijavo!" }] },
      { type: "paragraph", content: [{ type: "text", text: "Prvi odstavek." }] },
      { type: "paragraph", content: [{ type: "text", text: "Drugi odstavek." }] },
    ],
  },
  dayOffset: 0,
};

describe("emailSequenceStepSchema", () => {
  it("accepts a well-formed step", () => {
    expect(emailSequenceStepSchema.safeParse(validStep).success).toBe(true);
  });

  it("accepts an optional id (an existing step being edited)", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, id: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rejects a body with an empty content array", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, body: { type: "doc", content: [] } });
    expect(result.success).toBe(false);
  });

  it("rejects a negative dayOffset", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a dayOffset beyond Resend's scheduling ceiling", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: MAX_SCHEDULE_DAYS + 1 });
    expect(result.success).toBe(false);
  });

  it("accepts a dayOffset exactly at the ceiling", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: MAX_SCHEDULE_DAYS });
    expect(result.success).toBe(true);
  });

  it("rejects an empty subject", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, subject: "" });
    expect(result.success).toBe(false);
  });
});

describe("emailSequenceFormSchema", () => {
  const validForm = { name: "Prijave", triggerSource: "application" as const, enabled: true, steps: [validStep] };

  it("accepts a well-formed sequence", () => {
    expect(emailSequenceFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("accepts a null triggerSource (any source)", () => {
    expect(emailSequenceFormSchema.safeParse({ ...validForm, triggerSource: null }).success).toBe(true);
  });

  it("rejects an unknown triggerSource", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, triggerSource: "referral" });
    expect(result.success).toBe(false);
  });

  it("rejects zero steps", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than MAX_STEPS_PER_SEQUENCE steps", () => {
    const steps = Array.from({ length: MAX_STEPS_PER_SEQUENCE + 1 }, () => validStep);
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_STEPS_PER_SEQUENCE steps", () => {
    const steps = Array.from({ length: MAX_STEPS_PER_SEQUENCE }, () => validStep);
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, name: "" });
    expect(result.success).toBe(false);
  });
});
