import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/queries/rate-limit", () => ({
  incrementRateLimitCounter: vi.fn(),
}));

import { incrementRateLimitCounter } from "@/db/queries/rate-limit";
import { checkRateLimit } from "@/lib/rate-limit";

const mockIncrement = vi.mocked(incrementRateLimitCounter);

beforeEach(() => {
  mockIncrement.mockReset();
});

describe("checkRateLimit", () => {
  it("allows a request at exactly the limit", async () => {
    mockIncrement.mockResolvedValue(5);
    const ok = await checkRateLimit("bucket", { limit: 5, windowSeconds: 60 });
    expect(ok).toBe(true);
  });

  it("blocks a request one over the limit", async () => {
    mockIncrement.mockResolvedValue(6);
    const ok = await checkRateLimit("bucket", { limit: 5, windowSeconds: 60 });
    expect(ok).toBe(false);
  });

  it("fails open when the counter throws (DB outage must not block ingest)", async () => {
    mockIncrement.mockRejectedValue(new Error("db down"));
    const ok = await checkRateLimit("bucket", { limit: 5, windowSeconds: 60 });
    expect(ok).toBe(true);
  });

  it("buckets windowStart to a fixed boundary aligned to windowSeconds", async () => {
    let capturedWindowStart: Date | undefined;
    mockIncrement.mockImplementation(async (_bucket, windowStart) => {
      capturedWindowStart = windowStart;
      return 1;
    });
    await checkRateLimit("bucket", { limit: 5, windowSeconds: 600 });
    expect(capturedWindowStart).toBeDefined();
    expect(capturedWindowStart!.getTime() % (600 * 1000)).toBe(0);
  });
});
