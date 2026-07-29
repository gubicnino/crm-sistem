import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const onConflictDoNothingMock = vi.fn<(conflict: { target: unknown[] }) => { returning: typeof insertReturningMock }>(
  () => ({ returning: insertReturningMock }),
);
const valuesMock = vi.fn<(values: Record<string, unknown>) => { onConflictDoNothing: typeof onConflictDoNothingMock }>(
  () => ({ onConflictDoNothing: onConflictDoNothingMock }),
);

const selectWhereMock = vi.fn();
const selectFromMock = vi.fn<(table: unknown) => { where: typeof selectWhereMock }>(() => ({
  where: selectWhereMock,
}));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: valuesMock }),
    select: () => ({ from: selectFromMock }),
  },
}));

import { getOrCreateEmailBroadcast } from "@/db/queries/email-broadcasts";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");
const clientRequestId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  insertReturningMock.mockReset();
  onConflictDoNothingMock.mockClear();
  valuesMock.mockClear();
  selectWhereMock.mockReset();
  selectFromMock.mockClear();
});

describe("getOrCreateEmailBroadcast", () => {
  it("inserts a row scoped to the trainer with the given fields, including clientRequestId", async () => {
    insertReturningMock.mockResolvedValue([{ id: "bc-1" }]);
    const scheduledFor = new Date();

    await getOrCreateEmailBroadcast(scope, {
      clientRequestId,
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor,
      recipientCount: 3,
    });

    const values = valuesMock.mock.calls[0][0];
    expect(values).toMatchObject({
      trainerId: scope.trainerId,
      clientRequestId,
      subject: "Novica",
      scheduledFor,
      recipientCount: 3,
    });
  });

  it("targets (trainerId, clientRequestId) on conflict", async () => {
    insertReturningMock.mockResolvedValue([{ id: "bc-1" }]);

    await getOrCreateEmailBroadcast(scope, {
      clientRequestId,
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor: new Date(),
      recipientCount: 1,
    });

    const target = onConflictDoNothingMock.mock.calls[0][0].target;
    expect(target).toHaveLength(2);
  });

  it("returns the inserted row when no conflict occurs", async () => {
    insertReturningMock.mockResolvedValue([{ id: "bc-1", subject: "Novica" }]);

    const result = await getOrCreateEmailBroadcast(scope, {
      clientRequestId,
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor: new Date(),
      recipientCount: 1,
    });

    expect(result.id).toBe("bc-1");
    expect(selectFromMock).not.toHaveBeenCalled();
  });

  it("returns the existing row instead of inserting a duplicate when clientRequestId was already used (double-click/retry)", async () => {
    insertReturningMock.mockResolvedValue([]); // onConflictDoNothing swallowed the duplicate insert
    selectWhereMock.mockResolvedValue([{ id: "bc-existing", subject: "Novica" }]);

    const result = await getOrCreateEmailBroadcast(scope, {
      clientRequestId,
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor: new Date(),
      recipientCount: 1,
    });

    expect(result.id).toBe("bc-existing");
    expect(selectFromMock).toHaveBeenCalledTimes(1);
  });
});
