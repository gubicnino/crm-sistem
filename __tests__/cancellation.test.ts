import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelMock = vi.fn();
vi.mock("@/lib/email/client", () => ({
  resend: { emails: { cancel: (...args: unknown[]) => cancelMock(...args) } },
  FROM_EMAIL: "test@example.com",
}));

const listCancelableMock = vi.fn();
const updateScheduledEmailMock = vi.fn();
const updateScheduledEmailIfStatusMock = vi.fn();
vi.mock("@/db/queries/scheduled-emails", () => ({
  listCancelableScheduledEmails: (...args: unknown[]) => listCancelableMock(...args),
  updateScheduledEmail: (...args: unknown[]) => updateScheduledEmailMock(...args),
  updateScheduledEmailIfStatus: (...args: unknown[]) => updateScheduledEmailIfStatusMock(...args),
}));

import { cancelSequenceForLead } from "@/lib/email/cancel";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  cancelMock.mockReset();
  listCancelableMock.mockReset();
  updateScheduledEmailMock.mockReset();
  updateScheduledEmailIfStatusMock.mockReset();
});

describe("cancelSequenceForLead", () => {
  it("cancels a scheduled row with a resendEmailId when Resend confirms cancellation", async () => {
    listCancelableMock.mockResolvedValue([{ id: "row-1", resendEmailId: "resend-1", status: "scheduled" }]);
    cancelMock.mockResolvedValue({ data: {}, error: null });
    updateScheduledEmailIfStatusMock.mockResolvedValue(true);

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(cancelMock).toHaveBeenCalledWith("resend-1");
    expect(updateScheduledEmailIfStatusMock).toHaveBeenCalledWith(
      "row-1",
      "scheduled",
      expect.objectContaining({ status: "canceled" }),
    );
    expect(result).toEqual({ canceled: 1, alreadySent: 0, failed: 0 });
  });

  it("cancels a pending row with no resendEmailId without calling Resend", async () => {
    listCancelableMock.mockResolvedValue([{ id: "row-2", resendEmailId: null, status: "pending" }]);

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(cancelMock).not.toHaveBeenCalled();
    expect(updateScheduledEmailMock).toHaveBeenCalledWith("row-2", expect.objectContaining({ status: "canceled" }));
    expect(result.canceled).toBe(1);
  });

  it("treats Resend's real 'already sent' error (422 validation_error, 'not scheduled') as already-sent", async () => {
    // Verified live against the actual Resend API — see lib/email/cancel.ts's comment.
    listCancelableMock.mockResolvedValue([{ id: "row-3", resendEmailId: "resend-3", status: "scheduled" }]);
    cancelMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Email is not scheduled" },
    });

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(updateScheduledEmailMock).toHaveBeenCalledWith("row-3", expect.objectContaining({ status: "sent" }));
    expect(result).toEqual({ canceled: 0, alreadySent: 1, failed: 0 });
  });

  it("treats not_found as a genuine failure, NOT as already-sent", async () => {
    // Verified live: canceling an email within ~1s of scheduling it returned
    // 404 not_found even though it was genuinely still pending and cancelable
    // moments later. Treating not_found as "already sent" would risk
    // abandoning a still-outstanding email that Resend then delivers anyway.
    listCancelableMock.mockResolvedValue([{ id: "row-3b", resendEmailId: "resend-3b", status: "scheduled" }]);
    cancelMock.mockResolvedValue({ data: null, error: { name: "not_found", message: "Email not found" } });

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(updateScheduledEmailMock).toHaveBeenCalledWith(
      "row-3b",
      expect.objectContaining({ status: "cancel_failed" }),
    );
    expect(result).toEqual({ canceled: 0, alreadySent: 0, failed: 1 });
  });

  it("records any other error as cancel_failed and keeps processing later rows", async () => {
    listCancelableMock.mockResolvedValue([
      { id: "row-4", resendEmailId: "resend-4", status: "scheduled" },
      { id: "row-5", resendEmailId: "resend-5", status: "scheduled" },
    ]);
    cancelMock
      .mockResolvedValueOnce({ data: null, error: { name: "internal_server_error", message: "boom" } })
      .mockResolvedValueOnce({ data: {}, error: null });
    updateScheduledEmailIfStatusMock.mockResolvedValue(true);

    const result = await cancelSequenceForLead(scope, "lead-1");

    // One row's failure must not abort the loop — both rows get processed.
    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ canceled: 1, alreadySent: 0, failed: 1 });
  });

  it("a double-cancel is a harmless no-op", async () => {
    listCancelableMock.mockResolvedValue([{ id: "row-6", resendEmailId: "resend-6", status: "scheduled" }]);
    cancelMock.mockResolvedValue({ data: {}, error: null });
    // Simulates a prior call having already transitioned this row.
    updateScheduledEmailIfStatusMock.mockResolvedValue(false);

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(result.canceled).toBe(0);
  });

  it("returns zero counts when there is nothing to cancel", async () => {
    listCancelableMock.mockResolvedValue([]);

    const result = await cancelSequenceForLead(scope, "lead-1");

    expect(result).toEqual({ canceled: 0, alreadySent: 0, failed: 0 });
    expect(cancelMock).not.toHaveBeenCalled();
  });
});
