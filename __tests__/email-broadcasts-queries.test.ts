import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const valuesMock = vi.fn<(values: Record<string, unknown>) => { returning: typeof insertReturningMock }>(
  () => ({ returning: insertReturningMock }),
);

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: valuesMock }),
  },
}));

import { createEmailBroadcast } from "@/db/queries/email-broadcasts";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

beforeEach(() => {
  insertReturningMock.mockReset();
  valuesMock.mockClear();
});

describe("createEmailBroadcast", () => {
  it("inserts a row scoped to the trainer with the given fields", async () => {
    insertReturningMock.mockResolvedValue([{ id: "bc-1" }]);
    const scheduledFor = new Date();

    await createEmailBroadcast(scope, {
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor,
      recipientCount: 3,
    });

    const values = valuesMock.mock.calls[0][0];
    expect(values).toMatchObject({
      trainerId: scope.trainerId,
      subject: "Novica",
      scheduledFor,
      recipientCount: 3,
    });
  });

  it("returns the inserted row", async () => {
    insertReturningMock.mockResolvedValue([{ id: "bc-1", subject: "Novica" }]);

    const result = await createEmailBroadcast(scope, {
      subject: "Novica",
      body: { type: "doc", content: [] },
      scheduledFor: new Date(),
      recipientCount: 1,
    });

    expect(result.id).toBe("bc-1");
  });
});
