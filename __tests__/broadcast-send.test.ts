import { beforeEach, describe, expect, it, vi } from "vitest";

const createEmailBroadcastMock = vi.fn();
vi.mock("@/db/queries/email-broadcasts", () => ({
  createEmailBroadcast: (...args: unknown[]) => createEmailBroadcastMock(...args),
}));

const listLeadsByIdsMock = vi.fn();
vi.mock("@/db/queries/leads", () => ({
  listLeadsByIds: (...args: unknown[]) => listLeadsByIdsMock(...args),
}));

const reserveScheduledEmailsMock = vi.fn();
vi.mock("@/db/queries/scheduled-emails", () => ({
  reserveScheduledEmails: (...args: unknown[]) => reserveScheduledEmailsMock(...args),
}));

const getTrainerMock = vi.fn();
vi.mock("@/db/queries/trainers", () => ({
  getTrainer: (...args: unknown[]) => getTrainerMock(...args),
}));

const sendReservedStepMock = vi.fn();
vi.mock("@/lib/email/schedule", () => ({
  sendReservedStep: (...args: unknown[]) => sendReservedStepMock(...args),
}));

vi.mock("@/lib/email/client", () => ({ FROM_EMAIL: "Default <default@example.com>" }));
vi.mock("@/lib/unsubscribe", () => ({ unsubscribeLink: (leadId: string) => `https://example.com/u/${leadId}` }));

import { sendBroadcast } from "@/lib/email/broadcast";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");
const body = { type: "doc" as const, content: [] };

beforeEach(() => {
  createEmailBroadcastMock.mockReset();
  listLeadsByIdsMock.mockReset();
  reserveScheduledEmailsMock.mockReset();
  getTrainerMock.mockReset();
  sendReservedStepMock.mockReset();

  createEmailBroadcastMock.mockResolvedValue({ id: "bc-1" });
  getTrainerMock.mockResolvedValue({ name: "Janez", fromEmail: null });
});

describe("sendBroadcast", () => {
  it("reserves and sends to every eligible lead", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" },
      { id: "lead-2", name: "Bine", email: "bine@example.com", unsubscribedAt: null, stage: "email_lead" },
    ]);
    reserveScheduledEmailsMock
      .mockResolvedValueOnce([{ id: "se-1", leadId: "lead-1", scheduledFor: new Date() }])
      .mockResolvedValueOnce([{ id: "se-2", leadId: "lead-2", scheduledFor: new Date() }]);

    const result = await sendBroadcast(scope, {
      subject: "Novica",
      body,
      leadIds: ["lead-1", "lead-2"],
      scheduledFor: null,
    });

    expect(result).toEqual({ broadcastId: "bc-1", recipientCount: 2, skippedCount: 0 });
    expect(sendReservedStepMock).toHaveBeenCalledTimes(2);
  });

  it("hard-excludes an unsubscribed lead even if selected", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: new Date(), stage: "contacted" },
    ]);

    const result = await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["lead-1"], scheduledFor: null });

    expect(result).toEqual({ broadcastId: "bc-1", recipientCount: 0, skippedCount: 1 });
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
    expect(sendReservedStepMock).not.toHaveBeenCalled();
  });

  it("hard-excludes a lead at a terminal stage even if selected", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "client" },
    ]);

    const result = await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["lead-1"], scheduledFor: null });

    expect(result.skippedCount).toBe(1);
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
  });

  it("counts a leadId that resolves to no row (wrong trainer or deleted) as skipped", async () => {
    listLeadsByIdsMock.mockResolvedValue([]); // scoped lookup found nothing

    const result = await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["not-mine"], scheduledFor: null });

    expect(result).toEqual({ broadcastId: "bc-1", recipientCount: 0, skippedCount: 1 });
  });

  it("passes the eligible count as recipientCount when creating the broadcast row", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" },
    ]);
    reserveScheduledEmailsMock.mockResolvedValue([{ id: "se-1", leadId: "lead-1", scheduledFor: new Date() }]);

    await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["lead-1"], scheduledFor: null });

    expect(createEmailBroadcastMock).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ subject: "Novica", recipientCount: 1 }),
    );
  });

  it("defaults scheduledFor to roughly now when null (send now)", async () => {
    listLeadsByIdsMock.mockResolvedValue([]);

    await sendBroadcast(scope, { subject: "Novica", body, leadIds: [], scheduledFor: null });

    const passedScheduledFor = createEmailBroadcastMock.mock.calls[0][1].scheduledFor as Date;
    expect(passedScheduledFor.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(passedScheduledFor.getTime()).toBeLessThan(Date.now() + 5 * 60 * 1000);
  });

  it("uses the same sequenceStep (broadcast:<id>) for every reserved row, so a resend is idempotent per lead", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" },
    ]);
    reserveScheduledEmailsMock.mockResolvedValue([{ id: "se-1", leadId: "lead-1", scheduledFor: new Date() }]);

    await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["lead-1"], scheduledFor: null });

    const reserveArg = reserveScheduledEmailsMock.mock.calls[0][1][0];
    expect(reserveArg).toMatchObject({
      leadId: "lead-1",
      sequenceStep: "broadcast:bc-1",
      stepId: null,
      broadcastId: "bc-1",
      kind: "broadcast",
    });
  });

  it("does not count a lead as sent when reserveScheduledEmails returns nothing (already sent this broadcast)", async () => {
    listLeadsByIdsMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", unsubscribedAt: null, stage: "contacted" },
    ]);
    reserveScheduledEmailsMock.mockResolvedValue([]);

    const result = await sendBroadcast(scope, { subject: "Novica", body, leadIds: ["lead-1"], scheduledFor: null });

    expect(sendReservedStepMock).not.toHaveBeenCalled();
    expect(result.recipientCount).toBe(0);
  });
});
