import { describe, expect, it } from "vitest";
import { applicationQuestionsSchema, questionIdSchema } from "@/lib/validation/questions";

const base = { label: "Kakšen je tvoj cilj?", type: "text" as const, required: true };

describe("questionIdSchema", () => {
  it("accepts lowercase letters, digits, and underscores", () => {
    expect(questionIdSchema.safeParse("goal_1").success).toBe(true);
  });

  it("rejects uppercase letters", () => {
    expect(questionIdSchema.safeParse("Goal").success).toBe(false);
  });

  it("rejects spaces and punctuation", () => {
    expect(questionIdSchema.safeParse("goal 1").success).toBe(false);
    expect(questionIdSchema.safeParse("goal-1").success).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(questionIdSchema.safeParse("").success).toBe(false);
  });

  it("rejects an id longer than 64 characters", () => {
    expect(questionIdSchema.safeParse("a".repeat(65)).success).toBe(false);
  });
});

describe("applicationQuestionsSchema", () => {
  it("accepts a valid list of questions", () => {
    const result = applicationQuestionsSchema.safeParse([
      { id: "goal", ...base },
      { id: "experience", label: "Izkušnje", type: "select", required: false, options: ["malo", "veliko"] },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects duplicate ids within the same list", () => {
    const result = applicationQuestionsSchema.safeParse([
      { id: "goal", ...base },
      { id: "goal", ...base },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid id charset inside the list", () => {
    const result = applicationQuestionsSchema.safeParse([{ id: "Goal!", ...base }]);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown question type", () => {
    const result = applicationQuestionsSchema.safeParse([
      { id: "goal", label: "x", type: "date", required: true },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts an empty list", () => {
    expect(applicationQuestionsSchema.safeParse([]).success).toBe(true);
  });

  // Note: rejecting a CHANGE to an existing question's id is a UI-level rule
  // (components/settings/questions-editor.tsx disables the id input for rows
  // that existed on load), not something this stateless array schema can
  // enforce — it has no access to the "previous" list to diff against.
});
