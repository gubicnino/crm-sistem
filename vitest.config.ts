import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    // Bare "node_modules" only matches a top-level dir — it does NOT catch
    // node_modules nested inside a git worktree (.worktrees/**, or a
    // .claude/worktrees/** left behind by a harness-managed one), so a
    // worktree's own vendored __tests__ fixtures get picked up and run
    // twice. The recursive globs below cover any nesting depth, and
    // providing a custom `exclude` replaces vitest's own default
    // **/node_modules/** exclusion, so this can't just add to it.
    exclude: ["**/node_modules/**", "**/.next/**", ".worktrees/**", ".claude/worktrees/**"],
    // No tests exist until Phase 2 adds the first ones (tenant-scoping.test.ts).
    // Remove once real test files land, so an accidentally-empty suite fails loudly.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Mirrors tsconfig's "@/*" -> "./*" without adding vite-tsconfig-paths.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
