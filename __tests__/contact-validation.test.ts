import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/validation/contact";

describe("contactSchema", () => {
  it("accepts a valid submission", () => {
    const result = contactSchema.safeParse({
      name: "Janez Novak",
      email: "janez@example.com",
      message: "Zanima me dostop do sistema.",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email casing and whitespace", () => {
    const result = contactSchema.safeParse({
      name: "Janez Novak",
      email: "  Janez@Example.COM  ",
      message: "Zanima me dostop do sistema.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("janez@example.com");
    }
  });

  it("rejects an empty name", () => {
    const result = contactSchema.safeParse({ name: "", email: "janez@example.com", message: "Živjo" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = contactSchema.safeParse({ name: "Janez", email: "not-an-email", message: "Živjo" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = contactSchema.safeParse({ name: "Janez", email: "janez@example.com", message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a message longer than 2000 characters", () => {
    const result = contactSchema.safeParse({
      name: "Janez",
      email: "janez@example.com",
      message: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
