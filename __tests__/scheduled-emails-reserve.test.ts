import { beforeEach, describe, expect, it, vi } from "vitest";

const returningMock = vi.fn();
const onConflictDoNothingMock = vi.fn<(conflict: { target: unknown[] }) => { returning: typeof returningMock }>(
  () => ({ returning: returningMock }),
);
const valuesMock = vi.fn<(values: Record<string, unknown>[]) => { onConflictDoNothing: typeof onConflictDoNothingMock }>(
  () => ({ onConflictDoNothing: onConflictDoNothingMock }),
);

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: valuesMock }),
  },
}));

import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  returningMock.mockReset();
  onConflictDoNothingMock.mockClear();
  valuesMock.mockClear();
});

describe("reserveScheduledEmails", () => {
  it("targets the (leadId, sequenceStep, attempt) unique index on conflict", async () => {
    returningMock.mockResolvedValue([]);

    await reserveScheduledEmails(scope, [
      { leadId: "lead-1", sequenceStep: "step-1", stepId: "step-1", kind: "sequence", scheduledFor: new Date() },
    ]);

    const target = onConflictDoNothingMock.mock.calls[0][0].target;
    expect(target).toHaveLength(3);
  });

  it("passes kind and stepId through into the inserted row", async () => {
    returningMock.mockResolvedValue([]);

    await reserveScheduledEmails(scope, [
      { leadId: "lead-1", sequenceStep: "step-1", stepId: "step-1", kind: "sequence", scheduledFor: new Date() },
    ]);

    const values = valuesMock.mock.calls[0][0];
    expect(values[0]).toMatchObject({ stepId: "step-1", kind: "sequence" });
  });

  it("returns an empty array without querying when given no inputs", async () => {
    const result = await reserveScheduledEmails(scope, []);
    expect(result).toEqual([]);
    expect(valuesMock).not.toHaveBeenCalled();
  });
});
