import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
        "CFACTORY000000000000000000000000000000000000000000000000",
    },
  },
});
