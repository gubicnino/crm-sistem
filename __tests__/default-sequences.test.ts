import { describe, expect, it } from "vitest";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import { MAX_SCHEDULE_DAYS } from "@/lib/email/constants";
import { emailDocSchema } from "@/lib/validation/email-doc";

describe("DEFAULT_SEQUENCES", () => {
  it("defines exactly one sequence per lead source", () => {
    expect(DEFAULT_SEQUENCES.map((s) => s.triggerSource).sort()).toEqual(["application", "lead_magnet"]);
  });

  it("keeps every dayOffset within Resend's scheduling ceiling", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      for (const step of sequence.steps) {
        expect(step.dayOffset).toBeGreaterThanOrEqual(0);
        expect(step.dayOffset).toBeLessThanOrEqual(MAX_SCHEDULE_DAYS);
      }
    }
  });

  it("gives every sequence at least one step", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      expect(sequence.steps.length).toBeGreaterThan(0);
    }
  });

  it("gives every step a non-empty subject and a body that passes emailDocSchema", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      for (const step of sequence.steps) {
        expect(step.subject.length).toBeGreaterThan(0);
        const result = emailDocSchema.safeParse(step.body);
        expect(result.success).toBe(true);
      }
    }
  });

  it("gives every sequence a non-empty name", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      expect(sequence.name.length).toBeGreaterThan(0);
    }
  });
});
