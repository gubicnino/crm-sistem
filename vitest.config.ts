import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
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
