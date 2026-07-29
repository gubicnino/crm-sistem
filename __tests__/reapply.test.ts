import { beforeEach, describe, expect, it, vi } from "vitest";

const getEmailSequenceWithStepsMock = vi.fn();
const listLeadsEnrolledInSequenceMock = vi.fn();
const listScheduledEmailsForLeadInSequenceMock = vi.fn();
vi.mock("@/db/queries/email-sequences", () => ({
  getEmailSequenceWithSteps: (...args: unknown[]) => getEmailSequenceWithStepsMock(...args),
  listLeadsEnrolledInSequence: (...args: unknown[]) => listLeadsEnrolledInSequenceMock(...args),
  listScheduledEmailsForLeadInSequence: (...args: unknown[]) => listScheduledEmailsForLeadInSequenceMock(...args),
}));

const getLeadMock = vi.fn();
vi.mock("@/db/queries/leads", () => ({
  getLead: (...args: unknown[]) => getLeadMock(...args),
}));

const reserveScheduledEmailsMock = vi.fn();
vi.mock("@/db/queries/scheduled-emails", () => ({
  reserveScheduledEmails: (...args: unknown[]) => reserveScheduledEmailsMock(...args),
}));

const getTrainerMock = vi.fn();
vi.mock("@/db/queries/trainers", () => ({
  getTrainer: (...args: unknown[]) => getTrainerMock(...args),
}));

const cancelScheduledEmailRowsMock = vi.fn();
vi.mock("@/lib/email/cancel", () => ({
  cancelScheduledEmailRows: (...args: unknown[]) => cancelScheduledEmailRowsMock(...args),
}));

const sendReservedStepMock = vi.fn();
vi.mock("@/lib/email/schedule", () => ({
  sendReservedStep: (...args: unknown[]) => sendReservedStepMock(...args),
}));

vi.mock("@/lib/email/client", () => ({ FROM_EMAIL: "Default <default@example.com>" }));
vi.mock("@/lib/unsubscribe", () => ({ unsubscribeLink: (leadId: string) => `https://example.com/u/${leadId}` }));

import { applySequenceToExistingLeads, ApplyLimitExceededError } from "@/lib/email/reapply";
import { MAX_APPLY_TO_EXISTING_LEADS_PER_RUN } from "@/lib/email/constants";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

const step = { id: "step-1", subject: "S", body: { type: "doc", content: [] }, dayOffset: 5 };

beforeEach(() => {
  getEmailSequenceWithStepsMock.mockReset();
  listLeadsEnrolledInSequenceMock.mockReset();
  listScheduledEmailsForLeadInSequenceMock.mockReset();
  getLeadMock.mockReset();
  reserveScheduledEmailsMock.mockReset();
  getTrainerMock.mockReset();
  cancelScheduledEmailRowsMock.mockReset();
  sendReservedStepMock.mockReset();

  getEmailSequenceWithStepsMock.mockResolvedValue({ sequence: { id: "seq-1" }, steps: [step] });
  getTrainerMock.mockResolvedValue({ name: "Janez", fromEmail: null });
});

describe("applySequenceToExistingLeads", () => {
  it("throws ApplyLimitExceededError when more leads are enrolled than the cap", async () => {
    listLeadsEnrolledInSequenceMock.mockResolvedValue(
      Array.from({ length: MAX_APPLY_TO_EXISTING_LEADS_PER_RUN + 1 }, (_, i) => ({
        leadId: `lead-${i}`,
        enrolledAt: new Date(),
      })),
    );

    await expect(applySequenceToExistingLeads(scope, "seq-1")).rejects.toThrow(ApplyLimitExceededError);
  });

  it("skips an unsubscribed lead entirely", async () => {
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: new Date() }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", unsubscribedAt: new Date(), stage: "contacted" });

    const result = await applySequenceToExistingLeads(scope, "seq-1");

    expect(result).toEqual({ affectedLeads: 0, scheduledSteps: 0, skippedPastSteps: 0 });
    expect(cancelScheduledEmailRowsMock).not.toHaveBeenCalled();
  });

  it("skips a lead at a terminal stage entirely", async () => {
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: new Date() }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", unsubscribedAt: null, stage: "client" });

    const result = await applySequenceToExistingLeads(scope, "seq-1");

    expect(result.affectedLeads).toBe(0);
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
  });

  it("cancels existing cancelable rows before re-reserving", async () => {
    const farFutureEnrollment = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000); // so dayOffset:5 lands in the future
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: farFutureEnrollment }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" });
    listScheduledEmailsForLeadInSequenceMock.mockResolvedValue([
      { id: "se-old", sequenceStep: "step-1", attempt: 1, status: "scheduled" },
    ]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-new", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date() },
    ]);

    await applySequenceToExistingLeads(scope, "seq-1");

    expect(cancelScheduledEmailRowsMock).toHaveBeenCalledWith([
      { id: "se-old", sequenceStep: "step-1", attempt: 1, status: "scheduled" },
    ]);
  });

  it("computes the next attempt as 1 + the highest attempt this lead/step has ever used", async () => {
    const farFutureEnrollment = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: farFutureEnrollment }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" });
    listScheduledEmailsForLeadInSequenceMock.mockResolvedValue([
      { id: "se-1", sequenceStep: "step-1", attempt: 1, status: "sent" },
      { id: "se-2", sequenceStep: "step-1", attempt: 2, status: "canceled" },
    ]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-new", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date() },
    ]);

    await applySequenceToExistingLeads(scope, "seq-1");

    const reserveArg = reserveScheduledEmailsMock.mock.calls[0][1][0];
    expect(reserveArg.attempt).toBe(3);
  });

  it("skips a step whose recomputed scheduledFor is already in the past, without reserving it", async () => {
    const pastEnrollment = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // enrolledAt + 5 days is still in the past
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: pastEnrollment }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" });
    listScheduledEmailsForLeadInSequenceMock.mockResolvedValue([]);

    const result = await applySequenceToExistingLeads(scope, "seq-1");

    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
    expect(result.skippedPastSteps).toBe(1);
    expect(result.affectedLeads).toBe(0);
  });

  it("reserves and sends a step whose recomputed scheduledFor is in the future", async () => {
    const farFutureEnrollment = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: farFutureEnrollment }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" });
    listScheduledEmailsForLeadInSequenceMock.mockResolvedValue([]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-new", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) },
    ]);

    const result = await applySequenceToExistingLeads(scope, "seq-1");

    expect(sendReservedStepMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ affectedLeads: 1, scheduledSteps: 1, skippedPastSteps: 0 });
  });

  it("does not count a lead as affected when reserveScheduledEmails returns nothing (already re-applied)", async () => {
    const farFutureEnrollment = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
    listLeadsEnrolledInSequenceMock.mockResolvedValue([{ leadId: "lead-1", enrolledAt: farFutureEnrollment }]);
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" });
    listScheduledEmailsForLeadInSequenceMock.mockResolvedValue([]);
    reserveScheduledEmailsMock.mockResolvedValue([]);

    const result = await applySequenceToExistingLeads(scope, "seq-1");

    expect(sendReservedStepMock).not.toHaveBeenCalled();
    expect(result.affectedLeads).toBe(0);
  });
});
