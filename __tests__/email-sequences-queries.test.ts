import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSequenceReturningMock = vi.fn();
const insertStepsMock = vi.fn();
const updateSequenceReturningMock = vi.fn();
const deleteStepsMock = vi.fn();
const insertStepMock = vi.fn();

// A tiny, order-sensitive queue: each call to db.select() consumes the next
// entry, so a test can script "first select returns the count, second
// returns existing steps" without a single shared mock trying to do both.
let selectQueue: Array<() => unknown> = [];

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const next = selectQueue.shift();
      const resolved = next ? next() : undefined;
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(resolved),
            groupBy: () => Promise.resolve(resolved),
            limit: () => Promise.resolve(resolved),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
          }),
        }),
      };
    },
    insert: () => ({
      values: (values: unknown) => {
        if (Array.isArray(values)) {
          insertStepsMock(values);
          return Promise.resolve(undefined);
        }
        insertStepMock(values);
        return {
          returning: () => insertSequenceReturningMock(),
        };
      },
    }),
    update: () => ({
      set: (patch: unknown) => ({
        where: () => ({
          returning: () => updateSequenceReturningMock(patch),
        }),
      }),
    }),
    delete: () => ({
      where: () => deleteStepsMock(),
    }),
  },
}));

import {
  createEmailSequence,
  SequenceLimitExceededError,
  updateEmailSequence,
} from "@/db/queries/email-sequences";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

const validInput = {
  name: "Prijave",
  triggerSource: "application" as const,
  enabled: true,
  steps: [
    { subject: "Zadeva", heading: "Naslov", paragraphs: ["Odstavek."], dayOffset: 0 },
    { subject: "Zadeva 2", heading: "Naslov 2", paragraphs: ["Odstavek 2."], dayOffset: 2 },
  ],
};

beforeEach(() => {
  selectQueue = [];
  insertSequenceReturningMock.mockReset();
  insertStepsMock.mockReset();
  updateSequenceReturningMock.mockReset();
  deleteStepsMock.mockReset();
  insertStepMock.mockReset();
});

describe("createEmailSequence", () => {
  it("throws SequenceLimitExceededError at the cap", async () => {
    selectQueue.push(() => [{ total: MAX_SEQUENCES_PER_TRAINER }]);

    await expect(createEmailSequence(scope, validInput)).rejects.toThrow(SequenceLimitExceededError);
  });

  it("inserts the sequence and its steps with sequential positions when under the cap", async () => {
    selectQueue.push(() => [{ total: 0 }]);
    insertSequenceReturningMock.mockResolvedValue([{ id: "seq-1", name: "Prijave" }]);

    await createEmailSequence(scope, validInput);

    expect(insertStepsMock).toHaveBeenCalledWith([
      expect.objectContaining({ sequenceId: "seq-1", position: 0, dayOffset: 0 }),
      expect.objectContaining({ sequenceId: "seq-1", position: 1, dayOffset: 2 }),
    ]);
  });
});

describe("updateEmailSequence", () => {
  it("returns null when the sequence isn't found (wrong id or wrong trainer)", async () => {
    updateSequenceReturningMock.mockResolvedValue([]);

    const result = await updateEmailSequence(scope, "missing-seq", validInput);

    expect(result).toBeNull();
  });

  it("deletes steps that are no longer present in the input", async () => {
    updateSequenceReturningMock.mockResolvedValue([{ id: "seq-1" }]);
    selectQueue.push(() => [{ id: "step-old-1" }, { id: "step-old-2" }]);

    await updateEmailSequence(scope, "seq-1", validInput); // input carries no ids -> both are "removed"

    expect(deleteStepsMock).toHaveBeenCalled();
  });
});
