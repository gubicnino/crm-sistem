import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/email/copy";
import { MAX_SCHEDULE_DAYS } from "@/lib/email/constants";
import { SEQUENCES, sequenceFor } from "@/lib/email/sequences";

describe("SEQUENCES", () => {
  it("defines both lead sources", () => {
    expect(Object.keys(SEQUENCES).sort()).toEqual(["application", "lead_magnet"]);
  });

  it("keeps every dayOffset within Resend's scheduling ceiling", () => {
    for (const steps of Object.values(SEQUENCES)) {
      for (const step of steps) {
        expect(step.dayOffset).toBeGreaterThanOrEqual(0);
        expect(step.dayOffset).toBeLessThanOrEqual(MAX_SCHEDULE_DAYS);
      }
    }
  });

  it("has unique step ids within each sequence (the scheduled_emails unique index key)", () => {
    for (const steps of Object.values(SEQUENCES)) {
      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("has globally unique step ids across sequences (hygiene, not a schema requirement)", () => {
    const allIds = Object.values(SEQUENCES).flatMap((steps) => steps.map((s) => s.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("resolves every step's template to a real COPY entry with non-empty content", () => {
    for (const steps of Object.values(SEQUENCES)) {
      for (const step of steps) {
        expect(COPY[step.template]).toBeDefined();
        const rendered = COPY[step.template]({ leadName: "Ana", trainerName: "Janez" });
        expect(rendered.heading.length).toBeGreaterThan(0);
        expect(rendered.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it("renders non-empty subjects, with or without a lead name", () => {
    for (const steps of Object.values(SEQUENCES)) {
      for (const step of steps) {
        expect(step.subject({ leadName: null, trainerName: "Janez" }).length).toBeGreaterThan(0);
        expect(step.subject({ leadName: "Ana", trainerName: "Janez" }).length).toBeGreaterThan(0);
      }
    }
  });

  it("sequenceFor maps each source to its own sequence", () => {
    expect(sequenceFor("application")).toBe(SEQUENCES.application);
    expect(sequenceFor("lead_magnet")).toBe(SEQUENCES.lead_magnet);
  });
});
