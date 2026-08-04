import { beforeEach, describe, expect, it, vi } from "vitest";

const updateReturningMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: () => ({ set: () => ({ where: () => ({ returning: updateReturningMock }) }) }),
  },
}));

import { updateStageLabels } from "@/db/queries/trainers";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

const FULL_LABELS = {
  email_lead: "Nov email",
  application_received: "Prijava prejeta",
  contacted: "Kontaktiran",
  client: "Stranka",
  lost: "Izgubljen",
};

beforeEach(() => {
  updateReturningMock.mockReset();
});

describe("updateStageLabels", () => {
  it("returns the updated trainer when found", async () => {
    updateReturningMock.mockResolvedValue([{ id: scope.trainerId, stageLabels: FULL_LABELS }]);

    const trainer = await updateStageLabels(scope, FULL_LABELS);

    expect(trainer.stageLabels).toEqual(FULL_LABELS);
  });

  it("throws when the trainer row doesn't exist", async () => {
    updateReturningMock.mockResolvedValue([]);

    await expect(updateStageLabels(scope, FULL_LABELS)).rejects.toThrow("Trainer not found.");
  });
});

import { stageLabelsSchema } from "@/lib/validation/pipeline";

describe("stageLabelsSchema", () => {
  const VALID = {
    email_lead: "Nov email",
    application_received: "Prijava prejeta",
    contacted: "Kontaktiran",
    client: "Stranka",
    lost: "Izgubljen",
  };

  it("accepts a full valid record", () => {
    expect(stageLabelsSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = stageLabelsSchema.safeParse({ ...VALID, contacted: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a label over 30 characters", () => {
    const result = stageLabelsSchema.safeParse({ ...VALID, contacted: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("rejects a missing key", () => {
    const missingLost = Object.fromEntries(Object.entries(VALID).filter(([key]) => key !== "lost"));
    const result = stageLabelsSchema.safeParse(missingLost);
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = stageLabelsSchema.safeParse({ ...VALID, contacted: "  V pogovoru  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contacted).toBe("V pogovoru");
    }
  });
});

// vi.mock factories are hoisted above all top-level const declarations, so
// this can't close over the outer `scope` — it re-derives the same value via
// the real systemScope instead.
vi.mock("@/lib/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant")>();
  return {
    ...actual,
    requireTrainerOrThrow: vi.fn().mockResolvedValue(
      actual.systemScope("11111111-1111-1111-1111-111111111111", "cron_daily"),
    ),
  };
});

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

describe("updateStageLabelsAction", () => {
  it("returns a validation error without touching the DB when a label is invalid", async () => {
    const { updateStageLabelsAction } = await import("@/lib/actions/settings");

    const result = await updateStageLabelsAction({
      email_lead: "",
      application_received: "Prijava prejeta",
      contacted: "Kontaktiran",
      client: "Stranka",
      lost: "Izgubljen",
    });

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(updateReturningMock).not.toHaveBeenCalled();
  });

  it("persists and returns ok on a valid full record", async () => {
    const { updateStageLabelsAction } = await import("@/lib/actions/settings");
    updateReturningMock.mockResolvedValue([{ id: scope.trainerId, stageLabels: FULL_LABELS }]);

    const result = await updateStageLabelsAction(FULL_LABELS);

    expect(result).toEqual({ ok: true });
  });
});
