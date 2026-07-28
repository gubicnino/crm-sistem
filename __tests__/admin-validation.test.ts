import { describe, expect, it } from "vitest";
import { fromEmailSchema, inviteTrainerSchema, trainerIdSchema } from "@/lib/validation/admin";

describe("fromEmailSchema", () => {
  it("accepts a well-formed RFC 'Name <email>' string", () => {
    expect(fromEmailSchema.safeParse("Janez Novak <janez@sub.innosplet.com>").success).toBe(true);
  });

  it("rejects a bare email address with no display name", () => {
    expect(fromEmailSchema.safeParse("janez@sub.innosplet.com").success).toBe(false);
  });

  it("rejects a string with no angle brackets", () => {
    expect(fromEmailSchema.safeParse("Janez Novak janez@sub.innosplet.com").success).toBe(false);
  });

  it("rejects an invalid email inside the angle brackets", () => {
    expect(fromEmailSchema.safeParse("Janez Novak <not-an-email>").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(fromEmailSchema.safeParse("").success).toBe(false);
  });

  it("rejects a string over 300 characters", () => {
    const longName = "a".repeat(295);
    expect(fromEmailSchema.safeParse(`${longName} <a@b.com>`).success).toBe(false);
  });
});

describe("trainerIdSchema", () => {
  it("accepts a valid uuid", () => {
    expect(trainerIdSchema.safeParse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa").success).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    expect(trainerIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(trainerIdSchema.safeParse("").success).toBe(false);
  });
});

describe("inviteTrainerSchema", () => {
  it("normalizes and lowercases a valid email", () => {
    const result = inviteTrainerSchema.safeParse({ email: "  Trener@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("trener@example.com");
    }
  });

  it("rejects a malformed email", () => {
    expect(inviteTrainerSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(inviteTrainerSchema.safeParse({}).success).toBe(false);
  });
});
