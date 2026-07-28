import { describe, expect, it } from "vitest";
import { isTerminalStage, TERMINAL_STAGES } from "@/lib/pipeline";

describe("isTerminalStage", () => {
  it("returns true for client", () => {
    expect(isTerminalStage("client")).toBe(true);
  });

  it("returns true for lost", () => {
    expect(isTerminalStage("lost")).toBe(true);
  });

  it("returns false for a non-terminal stage", () => {
    expect(isTerminalStage("contacted")).toBe(false);
  });

  it("TERMINAL_STAGES contains exactly client and lost", () => {
    expect([...TERMINAL_STAGES].sort()).toEqual(["client", "lost"]);
  });
});
