import { beforeEach, describe, expect, it, vi } from "vitest";

const orderByMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: () => orderByMock(),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

import { listScheduledEmailsForTrainer } from "@/db/queries/scheduled-emails";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  orderByMock.mockReset();
});

describe("listScheduledEmailsForTrainer", () => {
  it("returns rows joined with the lead's name and email", async () => {
    orderByMock.mockResolvedValue([
      {
        id: "se-1",
        leadId: "lead-1",
        sequenceStep: "application_day0_confirmation",
        status: "scheduled",
        leadName: "Ana Kovač",
        leadEmail: "ana@example.com",
      },
    ]);

    const rows = await listScheduledEmailsForTrainer(scope);

    expect(rows).toHaveLength(1);
    expect(rows[0].leadName).toBe("Ana Kovač");
    expect(rows[0].leadEmail).toBe("ana@example.com");
  });
});
