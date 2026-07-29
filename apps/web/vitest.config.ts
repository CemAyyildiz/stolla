import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use jsdom environment so localStorage and other DOM APIs are available.
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
