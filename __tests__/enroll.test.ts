import { beforeEach, describe, expect, it, vi } from "vitest";

const listEnabledSequencesMock = vi.fn();
const reserveScheduledEmailsMock = vi.fn();
const getTrainerMock = vi.fn();
const sendReservedStepMock = vi.fn();

const listEnabledSequencesForStageMock = vi.fn();

vi.mock("@/db/queries/email-sequences", () => ({
  listEnabledSequencesForLeadCreated: (...args: unknown[]) => listEnabledSequencesMock(...args),
  listEnabledSequencesForStageEntered: (...args: unknown[]) => listEnabledSequencesForStageMock(...args),
}));
vi.mock("@/db/queries/scheduled-emails", () => ({
  reserveScheduledEmails: (...args: unknown[]) => reserveScheduledEmailsMock(...args),
}));
vi.mock("@/db/queries/trainers", () => ({
  getTrainer: (...args: unknown[]) => getTrainerMock(...args),
}));
vi.mock("@/lib/email/schedule", () => ({
  sendReservedStep: (...args: unknown[]) => sendReservedStepMock(...args),
}));
vi.mock("@/lib/email/client", () => ({ FROM_EMAIL: "Default <default@example.com>" }));
vi.mock("@/lib/unsubscribe", () => ({ unsubscribeLink: (leadId: string) => `https://example.com/u/${leadId}` }));

import { enrollLeadOnCreate, enrollLeadOnStageEntered } from "@/lib/email/enroll";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "site_key_ingest");

const baseLead = {
  id: "lead-1",
  trainerId: scope.trainerId,
  name: "Ana",
  email: "ana@example.com",
  source: "application" as const,
  stage: "application_received" as const,
  unsubscribedAt: null,
};

beforeEach(() => {
  listEnabledSequencesMock.mockReset();
  listEnabledSequencesForStageMock.mockReset();
  reserveScheduledEmailsMock.mockReset();
  getTrainerMock.mockReset();
  sendReservedStepMock.mockReset();
  getTrainerMock.mockResolvedValue({ name: "Janez", fromEmail: null });
});

describe("enrollLeadOnCreate", () => {
  it("does nothing when the lead is unsubscribed", async () => {
    await enrollLeadOnCreate(scope, { ...baseLead, unsubscribedAt: new Date() } as never);
    expect(listEnabledSequencesMock).not.toHaveBeenCalled();
  });

  it("does nothing when no sequence matches", async () => {
    listEnabledSequencesMock.mockResolvedValue([]);
    await enrollLeadOnCreate(scope, baseLead as never);
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
  });

  it("reserves and sends every step of a matching sequence", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-1", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date() },
    ]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).toHaveBeenCalledTimes(1);
    const [row, sentStep] = sendReservedStepMock.mock.calls[0];
    expect(row.id).toBe("se-1");
    expect(sentStep).toBe(step);
  });

  it("skips a reserved row whose sequenceStep matches no known step (defensive, should be unreachable)", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-1", leadId: "lead-1", sequenceStep: "unknown-step", scheduledFor: new Date() },
    ]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).not.toHaveBeenCalled();
  });

  it("skips reserving for a sequence when reserveScheduledEmails returns no rows (already enrolled)", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).not.toHaveBeenCalled();
  });
});

describe("enrollLeadOnStageEntered", () => {
  it("does nothing when the lead is unsubscribed", async () => {
    await enrollLeadOnStageEntered(scope, { ...baseLead, unsubscribedAt: new Date() } as never, "contacted");
    expect(listEnabledSequencesForStageMock).not.toHaveBeenCalled();
  });

  it("does nothing when no stage_entered sequence matches", async () => {
    listEnabledSequencesForStageMock.mockResolvedValue([]);
    await enrollLeadOnStageEntered(scope, baseLead as never, "contacted");
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
  });

  it("reserves and sends every step of a matching stage-triggered sequence", async () => {
    const step = { id: "step-1", subject: "S", body: { type: "doc", content: [] }, dayOffset: 0 };
    listEnabledSequencesForStageMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-1", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date() },
    ]);

    await enrollLeadOnStageEntered(scope, baseLead as never, "contacted");

    expect(listEnabledSequencesForStageMock).toHaveBeenCalledWith(scope, "contacted");
    expect(sendReservedStepMock).toHaveBeenCalledTimes(1);
  });

  it("never calls the lead_created lookup", async () => {
    listEnabledSequencesForStageMock.mockResolvedValue([]);
    await enrollLeadOnStageEntered(scope, baseLead as never, "contacted");
    expect(listEnabledSequencesMock).not.toHaveBeenCalled();
  });
});
