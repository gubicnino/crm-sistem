import { beforeEach, describe, expect, it, vi } from "vitest";

const createEmailSequenceMock = vi.fn();

vi.mock("@/db/queries/email-sequences", () => ({
  createEmailSequence: (...args: unknown[]) => createEmailSequenceMock(...args),
}));

import { seedDefaultSequencesForTrainer } from "@/lib/email/seed-defaults";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "registration");

beforeEach(() => {
  createEmailSequenceMock.mockReset();
});

describe("seedDefaultSequencesForTrainer", () => {
  it("creates one sequence per entry in DEFAULT_SEQUENCES", async () => {
    createEmailSequenceMock.mockResolvedValue({ id: "seq-1" });

    await seedDefaultSequencesForTrainer(scope);

    expect(createEmailSequenceMock).toHaveBeenCalledTimes(DEFAULT_SEQUENCES.length);
  });

  it("passes each sequence's name, triggerSource, and steps through, enabled by default", async () => {
    createEmailSequenceMock.mockResolvedValue({ id: "seq-1" });

    await seedDefaultSequencesForTrainer(scope);

    const firstCallInput = createEmailSequenceMock.mock.calls[0][1];
    expect(firstCallInput).toMatchObject({
      name: DEFAULT_SEQUENCES[0].name,
      triggerSource: DEFAULT_SEQUENCES[0].triggerSource,
      enabled: true,
    });
    expect(firstCallInput.steps).toHaveLength(DEFAULT_SEQUENCES[0].steps.length);
  });
});
