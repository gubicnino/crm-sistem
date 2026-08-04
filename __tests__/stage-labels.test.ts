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
