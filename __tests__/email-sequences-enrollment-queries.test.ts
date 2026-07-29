import { beforeEach, describe, expect, it, vi } from "vitest";

let selectQueue: Array<() => unknown> = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const resolve = () => {
            const next = selectQueue.shift();
            return Promise.resolve(next ? next() : []);
          };
          return {
            then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
              resolve().then(onFulfilled, onRejected),
          };
        },
      }),
    }),
  },
}));

import {
  listLeadsEnrolledInSequence,
  listScheduledEmailsForLeadInSequence,
} from "@/db/queries/email-sequences";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

beforeEach(() => {
  selectQueue = [];
});

describe("listLeadsEnrolledInSequence", () => {
  it("returns an empty array when the sequence has no steps", async () => {
    selectQueue.push(() => []);

    const result = await listLeadsEnrolledInSequence(scope, "seq-1");

    expect(result).toEqual([]);
  });

  it("groups scheduled_emails rows by lead, taking the earliest createdAt as enrolledAt", async () => {
    selectQueue.push(() => [{ id: "step-1" }, { id: "step-2" }]);
    selectQueue.push(() => [
      { leadId: "lead-1", createdAt: new Date("2026-01-05") },
      { leadId: "lead-1", createdAt: new Date("2026-01-01") }, // earlier — should win
      { leadId: "lead-2", createdAt: new Date("2026-01-03") },
    ]);

    const result = await listLeadsEnrolledInSequence(scope, "seq-1");

    expect(result).toHaveLength(2);
    const lead1 = result.find((r) => r.leadId === "lead-1");
    expect(lead1?.enrolledAt).toEqual(new Date("2026-01-01"));
    const lead2 = result.find((r) => r.leadId === "lead-2");
    expect(lead2?.enrolledAt).toEqual(new Date("2026-01-03"));
  });
});

describe("listScheduledEmailsForLeadInSequence", () => {
  it("returns rows scoped to the given lead and step ids", async () => {
    selectQueue.push(() => [{ id: "se-1", leadId: "lead-1", sequenceStep: "step-1", attempt: 1 }]);

    const result = await listScheduledEmailsForLeadInSequence(scope, "lead-1", ["step-1", "step-2"]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("se-1");
  });

  it("returns an empty array when given no step ids", async () => {
    const result = await listScheduledEmailsForLeadInSequence(scope, "lead-1", []);
    expect(result).toEqual([]);
  });
});
