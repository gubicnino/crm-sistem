import { describe, expect, it } from "vitest";
import { substituteVariables } from "@/lib/email/variables";

describe("substituteVariables", () => {
  it("replaces {{ime}} with the lead's name", () => {
    expect(substituteVariables("Pozdravljeni {{ime}}!", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Pozdravljeni Ana!",
    );
  });

  it("replaces {{trener}} with the trainer's name", () => {
    expect(substituteVariables("Lep pozdrav, {{trener}}", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Lep pozdrav, Janez",
    );
  });

  it("replaces {{ime}} with an empty string when the lead has no name", () => {
    expect(substituteVariables("Pozdravljeni {{ime}}!", { leadName: null, trainerName: "Janez" })).toBe(
      "Pozdravljeni !",
    );
  });

  it("replaces every occurrence, not just the first", () => {
    expect(substituteVariables("{{ime}}, {{ime}}!", { leadName: "Ana", trainerName: "Janez" })).toBe("Ana, Ana!");
  });

  it("leaves text with no tokens unchanged", () => {
    expect(substituteVariables("Navadno besedilo brez oklepajev.", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Navadno besedilo brez oklepajev.",
    );
  });

  it("leaves an unrecognized {{token}} untouched", () => {
    expect(substituteVariables("{{neznano}}", { leadName: "Ana", trainerName: "Janez" })).toBe("{{neznano}}");
  });
});
