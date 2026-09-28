import { defineConfig } from "vitest/config";
import path from "path";

/** Keep in sync with src/test-support/stellar/fixtures.ts labels. */
const FIXTURE_FACTORY =
  "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";
const FIXTURE_NFT =
  "CBNLN62LU545PM2ECR66E7SSUE6G3LOC5NSWH3SVYPS6J225NS72D2JB";
const FIXTURE_GOVERNOR =
  "CBCGFEJRIVHLPFXPUNQJ2LSL4YDBNSZVEHIDVYPIQZR2CRDS5EK64QWL";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts", "./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: FIXTURE_FACTORY,
      NEXT_PUBLIC_NFT_CONTRACT_ID: FIXTURE_NFT,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: FIXTURE_GOVERNOR,
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "1500000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
