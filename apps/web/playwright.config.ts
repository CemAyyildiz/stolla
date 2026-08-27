import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    // Browser fixtures are deliberately development-only; e2eMock refuses to
    // expose them from a production bundle. Production compilation is covered
    // independently by the build gate.
    command: `npm --prefix ../.. run clean && npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_E2E_MOCKS: "true",
      NEXT_PUBLIC_E2E_WALLET: "mock",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-rpc.invalid/",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
      NEXT_PUBLIC_NFT_CONTRACT_ID:
        "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "1",
    },
  },
});
