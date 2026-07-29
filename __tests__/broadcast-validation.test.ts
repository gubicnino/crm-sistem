import { describe, expect, it } from "vitest";
import { MAX_BROADCAST_RECIPIENTS, MAX_SCHEDULE_DAYS } from "@/lib/email/constants";
import { broadcastFormSchema } from "@/lib/validation/broadcast";

const validBody = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pozdravljeni." }] }] };

const validInput = {
  clientRequestId: "33333333-3333-4333-8333-333333333333",
  subject: "Novica za vas",
  body: validBody,
  leadIds: ["11111111-1111-4111-8111-111111111111"],
  scheduledFor: null,
};

describe("broadcastFormSchema", () => {
  it("accepts a well-formed immediate-send broadcast", () => {
    expect(broadcastFormSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a scheduledFor date within the Resend ceiling", () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const result = broadcastFormSchema.safeParse({ ...validInput, scheduledFor: future });
    expect(result.success).toBe(true);
  });

  it("rejects a scheduledFor date beyond Resend's scheduling ceiling", () => {
    const tooFar = new Date(Date.now() + (MAX_SCHEDULE_DAYS + 1) * 24 * 60 * 60 * 1000);
    const result = broadcastFormSchema.safeParse({ ...validInput, scheduledFor: tooFar });
    expect(result.success).toBe(false);
  });

  it("rejects an empty subject", () => {
    const result = broadcastFormSchema.safeParse({ ...validInput, subject: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a body that isn't a valid EmailDoc", () => {
    const result = broadcastFormSchema.safeParse({ ...validInput, body: { type: "doc", content: [] } });
    expect(result.success).toBe(false);
  });

  it("rejects zero selected leads", () => {
    const result = broadcastFormSchema.safeParse({ ...validInput, leadIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than MAX_BROADCAST_RECIPIENTS leads", () => {
    const leadIds = Array.from({ length: MAX_BROADCAST_RECIPIENTS + 1 }, () => "11111111-1111-4111-8111-111111111111");
    const result = broadcastFormSchema.safeParse({ ...validInput, leadIds });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid lead id", () => {
    const result = broadcastFormSchema.safeParse({ ...validInput, leadIds: ["not-a-uuid"] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid clientRequestId", () => {
    const result = broadcastFormSchema.safeParse({ ...validInput, clientRequestId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing clientRequestId", () => {
    const withoutId: Record<string, unknown> = { ...validInput };
    delete withoutId.clientRequestId;
    const result = broadcastFormSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });
});
