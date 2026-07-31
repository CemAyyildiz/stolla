import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // jsdom environment: supports React component tests (testing-library)
    // as well as pure TS unit tests (they don't require a browser).
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Covers both *.test.ts (pure unit tests) and *.test.tsx (component tests)
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // TypeScript path aliases so vitest resolves @/ the same way Next.js does
      "@": path.resolve(__dirname, "src"),
    },
  },
});
