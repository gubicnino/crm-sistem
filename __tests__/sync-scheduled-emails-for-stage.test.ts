import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelMock = vi.fn();
vi.mock("@/lib/email/client", () => ({
  resend: { emails: { cancel: (...args: unknown[]) => cancelMock(...args) } },
  FROM_EMAIL: "test@example.com",
}));

const updateScheduledEmailMock = vi.fn();
const updateScheduledEmailIfStatusMock = vi.fn();
vi.mock("@/db/queries/scheduled-emails", () => ({
  updateScheduledEmail: (...args: unknown[]) => updateScheduledEmailMock(...args),
  updateScheduledEmailIfStatus: (...args: unknown[]) => updateScheduledEmailIfStatusMock(...args),
}));

const listConditionalMock = vi.fn();
vi.mock("@/db/queries/email-sequences", () => ({
  listConditionalScheduledStepsForLead: (...args: unknown[]) => listConditionalMock(...args),
}));

import { syncScheduledEmailsForLeadStage } from "@/lib/email/cancel";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  cancelMock.mockReset();
  updateScheduledEmailMock.mockReset();
  updateScheduledEmailIfStatusMock.mockReset();
  listConditionalMock.mockReset();
});

describe("syncScheduledEmailsForLeadStage", () => {
  it("cancels a conditional step whose sendOnlyIfStage no longer includes the new stage", async () => {
    listConditionalMock.mockResolvedValue([
      { scheduledEmail: { id: "se-1", resendEmailId: "r-1", status: "scheduled" }, sendOnlyIfStage: ["email_lead"] },
    ]);
    cancelMock.mockResolvedValue({ data: {}, error: null });
    updateScheduledEmailIfStatusMock.mockResolvedValue(true);

    const result = await syncScheduledEmailsForLeadStage(scope, "lead-1", "contacted");

    expect(cancelMock).toHaveBeenCalledWith("r-1");
    expect(result.canceled).toBe(1);
  });

  it("leaves a conditional step alone when its sendOnlyIfStage still includes the new stage", async () => {
    listConditionalMock.mockResolvedValue([
      { scheduledEmail: { id: "se-2", resendEmailId: "r-2", status: "scheduled" }, sendOnlyIfStage: ["contacted"] },
    ]);

    const result = await syncScheduledEmailsForLeadStage(scope, "lead-1", "contacted");

    expect(cancelMock).not.toHaveBeenCalled();
    expect(result).toEqual({ canceled: 0, alreadySent: 0, failed: 0 });
  });

  it("does nothing when there are no conditional steps for this lead", async () => {
    listConditionalMock.mockResolvedValue([]);

    const result = await syncScheduledEmailsForLeadStage(scope, "lead-1", "contacted");

    expect(result).toEqual({ canceled: 0, alreadySent: 0, failed: 0 });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("processes multiple conditional steps independently", async () => {
    listConditionalMock.mockResolvedValue([
      { scheduledEmail: { id: "se-3", resendEmailId: "r-3", status: "scheduled" }, sendOnlyIfStage: ["email_lead"] },
      { scheduledEmail: { id: "se-4", resendEmailId: "r-4", status: "scheduled" }, sendOnlyIfStage: ["contacted"] },
    ]);
    cancelMock.mockResolvedValue({ data: {}, error: null });
    updateScheduledEmailIfStatusMock.mockResolvedValue(true);

    const result = await syncScheduledEmailsForLeadStage(scope, "lead-1", "contacted");

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).toHaveBeenCalledWith("r-3");
    expect(result.canceled).toBe(1);
  });
});
