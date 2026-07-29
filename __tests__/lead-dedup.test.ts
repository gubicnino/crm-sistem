import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const updateReturningMock = vi.fn();
const onConflictDoNothingMock = vi.fn<(conflict: { target: unknown[] }) => { returning: typeof insertReturningMock }>(
  () => ({ returning: insertReturningMock }),
);
const setMock = vi.fn<(values: Record<string, unknown>) => { where: () => { returning: typeof updateReturningMock } }>(
  () => ({ where: () => ({ returning: updateReturningMock }) }),
);

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: onConflictDoNothingMock,
      }),
    }),
    update: () => ({ set: setMock }),
  },
}));

const syncScheduledEmailsForLeadStageMock = vi.fn();
vi.mock("@/lib/email/cancel", () => ({
  syncScheduledEmailsForLeadStage: (...args: unknown[]) => syncScheduledEmailsForLeadStageMock(...args),
}));

const enrollLeadOnStageEnteredMock = vi.fn();
vi.mock("@/lib/email/enroll", () => ({
  enrollLeadOnStageEntered: (...args: unknown[]) => enrollLeadOnStageEnteredMock(...args),
}));

import { createLeadFromIntake } from "@/db/queries/leads";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "site_key_ingest");

beforeEach(() => {
  insertReturningMock.mockReset();
  updateReturningMock.mockReset();
  onConflictDoNothingMock.mockClear();
  setMock.mockClear();
  syncScheduledEmailsForLeadStageMock.mockReset();
  enrollLeadOnStageEnteredMock.mockReset();
});

describe("createLeadFromIntake", () => {
  it("targets the (trainerId, email) unique index on conflict", async () => {
    insertReturningMock.mockResolvedValue([{ id: "lead-1", email: "a@example.com" }]);

    await createLeadFromIntake(scope, {
      email: "a@example.com",
      source: "application",
      stage: "application_received",
    });

    expect(onConflictDoNothingMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
    const target = onConflictDoNothingMock.mock.calls[0][0].target;
    expect(target).toHaveLength(2);
  });

  it("returns isNew: true and never updates when the insert succeeds", async () => {
    insertReturningMock.mockResolvedValue([{ id: "lead-1", email: "a@example.com" }]);

    const result = await createLeadFromIntake(scope, {
      email: "a@example.com",
      source: "application",
      stage: "application_received",
    });

    expect(result.isNew).toBe(true);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("on a conflict, always refreshes name and phone only", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-2", email: "b@example.com" }]);

    const result = await createLeadFromIntake(scope, {
      name: "Nova Ime",
      email: "b@example.com",
      phone: "041123456",
      source: "lead_magnet",
      stage: "email_lead",
    });

    expect(result.isNew).toBe(false);
    expect(setMock).toHaveBeenCalledWith({ name: "Nova Ime", phone: "041123456" });
  });

  it("on a conflicting application submission, also merges source and answers", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-3", email: "c@example.com", stage: "application_received" }]);

    await createLeadFromIntake(scope, {
      name: "Ana",
      email: "c@example.com",
      source: "application",
      stage: "application_received",
      answers: { goal: "Shujšati" },
    });

    const setArg = setMock.mock.calls[0][0];
    expect(setArg.name).toBe("Ana");
    expect(setArg.source).toBe("application");
    expect(setArg.answers).toEqual({ goal: "Shujšati" });
    // The stage field is a Postgres CASE expression (SQL fragment) — its
    // *runtime* correctness (only advances out of email_lead) is not
    // verifiable against a mocked db and must be checked manually against a
    // real database; see this task's Step 8.
    expect(setArg.stage).toBeDefined();
  });

  it("on a conflicting application submission, syncs and enrolls for the resulting stage (Phase 3)", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-3", email: "c@example.com", stage: "application_received" }]);

    await createLeadFromIntake(scope, {
      name: "Ana",
      email: "c@example.com",
      source: "application",
      stage: "application_received",
      answers: { goal: "Shujšati" },
    });

    expect(syncScheduledEmailsForLeadStageMock).toHaveBeenCalledWith(scope, "lead-3", "application_received");
    expect(enrollLeadOnStageEnteredMock).toHaveBeenCalledWith(
      scope,
      { id: "lead-3", email: "c@example.com", stage: "application_received" },
      "application_received",
    );
  });

  it("on a conflicting lead_magnet submission, never includes source, answers, or stage in the update", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-4", email: "d@example.com" }]);

    await createLeadFromIntake(scope, {
      email: "d@example.com",
      source: "lead_magnet",
      stage: "email_lead",
    });

    const setArg = setMock.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("source");
    expect(setArg).not.toHaveProperty("answers");
    expect(setArg).not.toHaveProperty("stage");
  });

  it("on a conflicting lead_magnet submission, never syncs or enrolls (stage never changes on this branch)", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-4", email: "d@example.com" }]);

    await createLeadFromIntake(scope, {
      email: "d@example.com",
      source: "lead_magnet",
      stage: "email_lead",
    });

    expect(syncScheduledEmailsForLeadStageMock).not.toHaveBeenCalled();
    expect(enrollLeadOnStageEnteredMock).not.toHaveBeenCalled();
  });
});
