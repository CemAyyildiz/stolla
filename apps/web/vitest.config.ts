import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Run in Node environment — these are pure TS unit tests, not browser tests.
    environment: "node",
    // Glob for test files
    include: ["src/**/*.test.ts"],
    // TypeScript path aliases so vitest resolves @/ the same way Next.js does
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
