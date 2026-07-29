import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSequenceReturningMock = vi.fn();
const insertStepsMock = vi.fn();
const insertStepMock = vi.fn();

let selectQueue: Array<() => unknown> = [];
let joinSelectQueue: Array<() => unknown> = [];

vi.mock("@/db", () => ({
  db: {
    // .from() returns both chains; which one a caller actually invokes
    // (.innerJoin(...).where(...) vs. .where(...).orderBy(...)) determines
    // which queue is consumed — listConditionalScheduledStepsForLead uses
    // the join shape, everything else here uses the plain select shape.
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => {
            const next = joinSelectQueue.shift();
            return Promise.resolve(next ? next() : []);
          },
        }),
        where: () => {
          // Awaited directly (the cap-check in createEmailSequence) or
          // chained with .orderBy() (listEnabledSequencesForStageEntered) —
          // both need to consume the same queue entry, so this object is
          // both thenable and .orderBy()-able.
          const resolve = () => {
            const next = selectQueue.shift();
            return Promise.resolve(next ? next() : []);
          };
          return {
            orderBy: resolve,
            then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
              resolve().then(onFulfilled, onRejected),
          };
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        if (Array.isArray(values)) {
          insertStepsMock(values);
          return Promise.resolve(undefined);
        }
        insertStepMock(values);
        return { returning: () => insertSequenceReturningMock() };
      },
    }),
  },
}));

import {
  createEmailSequence,
  listConditionalScheduledStepsForLead,
  listEnabledSequencesForStageEntered,
} from "@/db/queries/email-sequences";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

beforeEach(() => {
  selectQueue = [];
  joinSelectQueue = [];
  insertSequenceReturningMock.mockReset();
  insertStepsMock.mockReset();
  insertStepMock.mockReset();
});

describe("createEmailSequence — stage_entered trigger", () => {
  it("persists triggerStage and a null triggerSource", async () => {
    selectQueue.push(() => [{ total: 0 }]);
    insertSequenceReturningMock.mockResolvedValue([{ id: "seq-1" }]);

    await createEmailSequence(scope, {
      name: "Po kontaktu",
      triggerType: "stage_entered",
      triggerStage: "contacted",
      enabled: true,
      steps: [
        {
          subject: "Zadeva",
          body: { type: "doc", content: [] },
          dayOffset: 0,
          sendOnlyIfStage: ["contacted"],
        },
      ],
    });

    expect(insertStepMock).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "stage_entered", triggerStage: "contacted", triggerSource: null }),
    );
    expect(insertStepsMock).toHaveBeenCalledWith([expect.objectContaining({ sendOnlyIfStage: ["contacted"] })]);
  });

  it("defaults a step's sendOnlyIfStage to null when omitted", async () => {
    selectQueue.push(() => [{ total: 0 }]);
    insertSequenceReturningMock.mockResolvedValue([{ id: "seq-1" }]);

    await createEmailSequence(scope, {
      name: "Prijave",
      triggerType: "lead_created",
      triggerSource: null,
      enabled: true,
      steps: [{ subject: "Zadeva", body: { type: "doc", content: [] }, dayOffset: 0 }],
    });

    expect(insertStepsMock).toHaveBeenCalledWith([expect.objectContaining({ sendOnlyIfStage: null })]);
  });
});

describe("listEnabledSequencesForStageEntered", () => {
  it("groups steps under their matching stage-triggered sequence", async () => {
    selectQueue.push(() => [{ id: "seq-1", triggerType: "stage_entered", triggerStage: "contacted" }]);
    selectQueue.push(() => [{ id: "step-1", sequenceId: "seq-1", position: 0 }]);

    const result = await listEnabledSequencesForStageEntered(scope, "contacted");

    expect(result).toHaveLength(1);
    expect(result[0].sequence.id).toBe("seq-1");
    expect(result[0].steps).toHaveLength(1);
  });

  it("returns an empty array when no sequence matches the stage", async () => {
    selectQueue.push(() => []);

    const result = await listEnabledSequencesForStageEntered(scope, "contacted");

    expect(result).toEqual([]);
  });
});

describe("listConditionalScheduledStepsForLead", () => {
  it("excludes rows whose step has no sendOnlyIfStage condition", async () => {
    joinSelectQueue.push(() => [
      { scheduledEmail: { id: "se-1" }, sendOnlyIfStage: ["contacted"] },
      { scheduledEmail: { id: "se-2" }, sendOnlyIfStage: null },
    ]);

    const result = await listConditionalScheduledStepsForLead(scope, "lead-1");

    expect(result).toHaveLength(1);
    expect(result[0].scheduledEmail.id).toBe("se-1");
  });
});
