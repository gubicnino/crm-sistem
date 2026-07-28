import { describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import { applyImpersonationUpdate } from "@/lib/impersonation";

const TRAINER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRAINER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseToken(overrides: Partial<JWT> = {}): JWT {
  return {
    sub: "user-1",
    email: "trainer@example.com",
    trainerId: TRAINER_B,
    role: "trainer",
    ...overrides,
  } as JWT;
}

describe("applyImpersonationUpdate", () => {
  it("THE tenant-isolation bypass test: a non-admin token is returned unchanged even with a well-formed valid payload", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken({ role: "trainer" });

    const result = await applyImpersonationUpdate(
      token,
      { user: { impersonatingTrainerId: TRAINER_A } },
      isImpersonableTrainer,
    );

    expect(result).toEqual(token);
    expect(result.trainerId).toBe(TRAINER_B); // still the trainer's own tenant
  });

  it("ignores a role claim inside the payload — authority comes only from the signed token", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken({ role: "trainer" });

    // Some client could try to smuggle `role: "admin"` into the update body.
    // The payload param is `unknown`, so this extra field isn't even a type
    // error — it's simply ignored by the schema, which is the point.
    const result = await applyImpersonationUpdate(
      token,
      { user: { impersonatingTrainerId: TRAINER_A }, role: "admin" },
      isImpersonableTrainer,
    );

    expect(result).toEqual(token);
  });

  it("never calls isImpersonableTrainer for a non-admin token — the authority check short-circuits before any DB work", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken({ role: "trainer" });

    await applyImpersonationUpdate(token, { user: { impersonatingTrainerId: TRAINER_A } }, isImpersonableTrainer);

    expect(isImpersonableTrainer).not.toHaveBeenCalled();
  });

  it("treats a token with no role (e.g. minted before this feature) as non-admin", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken();
    delete token.role;

    const result = await applyImpersonationUpdate(
      token,
      { user: { impersonatingTrainerId: TRAINER_A } },
      isImpersonableTrainer,
    );

    expect(result).toEqual(token);
    expect(isImpersonableTrainer).not.toHaveBeenCalled();
  });

  it("leaves the token unchanged when the target trainer is nonexistent or deactivated", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(false);
    const token = baseToken({ role: "admin", trainerId: undefined });

    const result = await applyImpersonationUpdate(
      token,
      { user: { impersonatingTrainerId: TRAINER_A } },
      isImpersonableTrainer,
    );

    expect(result).toEqual(token);
    expect(isImpersonableTrainer).toHaveBeenCalledWith(TRAINER_A);
  });

  it("sets trainerId and impersonatingTrainerId to the target for a valid admin request", async () => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken({ role: "admin", trainerId: undefined, sub: "admin-1", email: "ops@example.com" });

    const result = await applyImpersonationUpdate(
      token,
      { user: { impersonatingTrainerId: TRAINER_A } },
      isImpersonableTrainer,
    );

    expect(result.trainerId).toBe(TRAINER_A);
    expect(result.impersonatingTrainerId).toBe(TRAINER_A);
    // The admin's own identity and role survive untouched.
    expect(result.role).toBe("admin");
    expect(result.sub).toBe("admin-1");
    expect(result.email).toBe("ops@example.com");
  });

  it("clears trainerId and impersonatingTrainerId on exit (null target)", async () => {
    const isImpersonableTrainer = vi.fn();
    const token = baseToken({ role: "admin", trainerId: TRAINER_A, impersonatingTrainerId: TRAINER_A });

    const result = await applyImpersonationUpdate(token, { user: { impersonatingTrainerId: null } }, isImpersonableTrainer);

    expect(result.trainerId).toBeUndefined();
    expect(result.impersonatingTrainerId).toBeUndefined();
    expect(isImpersonableTrainer).not.toHaveBeenCalled();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty object", {}],
    ["a bare string", "admin"],
    ["a top-level trainerId instead of nested user.impersonatingTrainerId", { trainerId: TRAINER_A }],
    ["an empty user object", { user: {} }],
    ["a non-uuid impersonatingTrainerId", { user: { impersonatingTrainerId: "not-a-uuid" } }],
    ["a top-level impersonatingTrainerId (not nested under user)", { impersonatingTrainerId: TRAINER_A }],
  ])("returns the token unchanged for a malformed payload — %s — even for an admin", async (_label, payload) => {
    const isImpersonableTrainer = vi.fn().mockResolvedValue(true);
    const token = baseToken({ role: "admin", trainerId: undefined });

    const result = await applyImpersonationUpdate(token, payload, isImpersonableTrainer);

    expect(result).toEqual(token);
    expect(isImpersonableTrainer).not.toHaveBeenCalled();
  });
});
