import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const updateReturningMock = vi.fn();
const deleteReturningMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: insertReturningMock }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: updateReturningMock }) }) }),
    delete: () => ({ where: () => ({ returning: deleteReturningMock }) }),
  },
}));

import { createLead, deleteLead, updateLead } from "@/db/queries/leads";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  insertReturningMock.mockReset();
  updateReturningMock.mockReset();
  deleteReturningMock.mockReset();
});

describe("createLead", () => {
  it("creates a manually-added lead starting at email_lead / application source", async () => {
    insertReturningMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", stage: "email_lead", source: "application" },
    ]);

    const lead = await createLead(scope, { name: "Ana", email: "ana@example.com" });

    expect(lead.stage).toBe("email_lead");
    expect(lead.source).toBe("application");
  });
});

describe("updateLead", () => {
  it("returns the updated lead when found", async () => {
    updateReturningMock.mockResolvedValue([{ id: "lead-1", name: "Nova", email: "nova@example.com" }]);

    const lead = await updateLead(scope, "lead-1", { name: "Nova", email: "nova@example.com" });

    expect(lead?.name).toBe("Nova");
  });

  it("returns null when the lead doesn't exist or isn't owned by this trainer", async () => {
    updateReturningMock.mockResolvedValue([]);

    const lead = await updateLead(scope, "lead-1", { email: "x@example.com" });

    expect(lead).toBeNull();
  });
});

describe("deleteLead", () => {
  it("returns true when a row was deleted", async () => {
    deleteReturningMock.mockResolvedValue([{ id: "lead-1" }]);

    expect(await deleteLead(scope, "lead-1")).toBe(true);
  });

  it("returns false when nothing was deleted", async () => {
    deleteReturningMock.mockResolvedValue([]);

    expect(await deleteLead(scope, "lead-1")).toBe(false);
  });
});
