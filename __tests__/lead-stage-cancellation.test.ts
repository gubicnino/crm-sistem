import { beforeEach, describe, expect, it, vi } from "vitest";

const returningMock = vi.fn();
vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => returningMock(),
        }),
      }),
    }),
  },
}));

const cancelSequenceForLeadMock = vi.fn();
const syncScheduledEmailsForLeadStageMock = vi.fn();
vi.mock("@/lib/email/cancel", () => ({
  cancelSequenceForLead: (...args: unknown[]) => cancelSequenceForLeadMock(...args),
  syncScheduledEmailsForLeadStage: (...args: unknown[]) => syncScheduledEmailsForLeadStageMock(...args),
}));

const enrollLeadOnStageEnteredMock = vi.fn();
vi.mock("@/lib/email/enroll", () => ({
  enrollLeadOnStageEntered: (...args: unknown[]) => enrollLeadOnStageEnteredMock(...args),
}));

import { setLeadStage } from "@/db/queries/leads";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  returningMock.mockReset();
  cancelSequenceForLeadMock.mockReset();
  syncScheduledEmailsForLeadStageMock.mockReset();
  enrollLeadOnStageEnteredMock.mockReset();
});

describe("setLeadStage", () => {
  it("triggers cancellation when moving a lead to client — the mandatory case", async () => {
    returningMock.mockResolvedValue([{ id: "lead-1", stage: "client" }]);

    await setLeadStage(scope, "lead-1", "client");

    expect(cancelSequenceForLeadMock).toHaveBeenCalledWith(scope, "lead-1");
  });

  it("triggers cancellation when moving a lead to lost", async () => {
    returningMock.mockResolvedValue([{ id: "lead-1", stage: "lost" }]);

    await setLeadStage(scope, "lead-1", "lost");

    expect(cancelSequenceForLeadMock).toHaveBeenCalledWith(scope, "lead-1");
  });

  it("does not trigger cancellation for a non-terminal stage change, but does sync/enroll (Phase 3)", async () => {
    returningMock.mockResolvedValue([{ id: "lead-1", stage: "contacted" }]);

    await setLeadStage(scope, "lead-1", "contacted");

    expect(cancelSequenceForLeadMock).not.toHaveBeenCalled();
    expect(syncScheduledEmailsForLeadStageMock).toHaveBeenCalledWith(scope, "lead-1", "contacted");
    expect(enrollLeadOnStageEnteredMock).toHaveBeenCalledWith(scope, { id: "lead-1", stage: "contacted" }, "contacted");
  });

  it("throws if the lead is not found or not owned by this trainer", async () => {
    returningMock.mockResolvedValue([]);

    await expect(setLeadStage(scope, "lead-1", "client")).rejects.toThrow();
  });
});
