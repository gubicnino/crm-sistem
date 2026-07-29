import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelMock = vi.fn();
vi.mock("@/lib/email/client", () => ({
  resend: { emails: { cancel: (...args: unknown[]) => cancelMock(...args) } },
  FROM_EMAIL: "test@example.com",
}));

const updateScheduledEmailMock = vi.fn();
const updateScheduledEmailIfStatusMock = vi.fn();
vi.mock("@/db/queries/scheduled-emails", () => ({
  listCancelableScheduledEmails: vi.fn(),
  listCancelableScheduledEmailsForTrainer: vi.fn(),
  updateScheduledEmail: (...args: unknown[]) => updateScheduledEmailMock(...args),
  updateScheduledEmailIfStatus: (...args: unknown[]) => updateScheduledEmailIfStatusMock(...args),
}));

import { cancelScheduledEmailRows } from "@/lib/email/cancel";

beforeEach(() => {
  cancelMock.mockReset();
  updateScheduledEmailMock.mockReset();
  updateScheduledEmailIfStatusMock.mockReset();
});

describe("cancelScheduledEmailRows", () => {
  it("cancels each given row against Resend, same as cancelSequenceForLead", async () => {
    cancelMock.mockResolvedValue({ data: {}, error: null });
    updateScheduledEmailIfStatusMock.mockResolvedValue(true);

    const result = await cancelScheduledEmailRows([
      { id: "row-1", resendEmailId: "r-1", status: "scheduled" } as never,
      { id: "row-2", resendEmailId: "r-2", status: "scheduled" } as never,
    ]);

    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ canceled: 2, alreadySent: 0, failed: 0 });
  });

  it("returns zero counts for an empty row list without calling Resend", async () => {
    const result = await cancelScheduledEmailRows([]);
    expect(result).toEqual({ canceled: 0, alreadySent: 0, failed: 0 });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("cancels a pending row with no resendEmailId without calling Resend", async () => {
    const result = await cancelScheduledEmailRows([{ id: "row-3", resendEmailId: null, status: "pending" } as never]);

    expect(cancelMock).not.toHaveBeenCalled();
    expect(updateScheduledEmailMock).toHaveBeenCalledWith("row-3", expect.objectContaining({ status: "canceled" }));
    expect(result.canceled).toBe(1);
  });
});
