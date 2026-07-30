import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Tenant-isolation guardrail (see CLAUDE.md "Tenant isolation is non-negotiable"
  // and lib/tenant.ts): the raw Drizzle client may only be imported where every
  // query is required to take a TrainerScope as its first argument. Everywhere
  // else must go through db/queries/** so a scoped filter can't be forgotten.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["db/queries/**", "db/migrate.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db",
              message:
                "Do not import the db client directly. Add or use a function in db/queries/** — every query there takes a TrainerScope so it can't skip tenant scoping.",
            },
            {
              name: "@/db/index",
              message:
                "Do not import the db client directly. Add or use a function in db/queries/** — every query there takes a TrainerScope so it can't skip tenant scoping.",
            },
          ],
        },
      ],
    },
  },
  // Cancellation guardrail (see CLAUDE.md "Follow-up emails" — cancellation on
  // stage change is mandatory, not optional): db/queries/leads.ts's
  // setLeadStage() is the only function allowed to write `stage`, because it
  // internally triggers cancelSequenceForLead(). A `.set({ stage: ... })`
  // anywhere else could silently skip cancellation for a converted/lost lead.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["db/queries/leads.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='set'] ObjectExpression > Property[key.name='stage']",
          message:
            "Do not write leads.stage directly. Use setLeadStage() from db/queries/leads.ts — it's the only place cancelSequenceForLead() is guaranteed to run.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees (see superpowers:using-git-worktrees) are full
    // repo checkouts with their own source tree — without this, lint runs
    // from the main checkout also lint (and fail on) whatever branch state
    // a worktree happens to be sitting on.
    ".worktrees/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
