import { describe, expect, it } from "vitest";
import { pipelineStageEnum } from "@/db/schema";

describe("pipelineStageEnum", () => {
  it("has exactly the 4-stage-plus-lost set, in order", () => {
    expect(pipelineStageEnum.enumValues).toEqual([
      "email_lead",
      "application_received",
      "contacted",
      "client",
      "lost",
    ]);
  });
});
