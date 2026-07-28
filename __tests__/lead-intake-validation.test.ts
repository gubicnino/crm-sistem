import { describe, expect, it } from "vitest";
import { leadIntakeSchema } from "@/lib/validation/lead-intake";

describe("leadIntakeSchema", () => {
  it("accepts a minimal valid application payload", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test_1234",
      source: "application",
      email: "test@example.com",
      answers: { goal: "shujšanje" },
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase and trims it", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test_1234",
      source: "lead_magnet",
      email: "  Test@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 40 answer keys", () => {
    const answers = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`q${i}`, "x"]));
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "a@b.si",
      answers,
    });
    expect(result.success).toBe(false);
  });

  it("accepts an unknown answer key — permissive by design, see the schema's comment", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "a@b.si",
      answers: { some_question_not_in_current_config: "value" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts the honeypot field so the route handler can check it", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "a@b.si",
      website: "http://spam.example",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe("http://spam.example");
    }
  });

  it("strips an attacker-supplied trainerId — it is not part of the schema", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "a@b.si",
      trainerId: "some-other-trainers-uuid",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).trainerId).toBeUndefined();
    }
  });

  it("rejects a name longer than 200 characters", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "application",
      email: "a@b.si",
      name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown source value", () => {
    const result = leadIntakeSchema.safeParse({
      siteKey: "pk_test",
      source: "referral",
      email: "a@b.si",
    });
    expect(result.success).toBe(false);
  });
});
