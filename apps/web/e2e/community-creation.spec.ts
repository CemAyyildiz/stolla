/**
 * Covers issue #151: Playwright community creation with mocked wallet and RPC.
 */
import { expect, test } from "@playwright/test";
import {
  FACTORY_ID,
  TESTNET_PASSPHRASE,
  WALLET_ADDRESS,
  completeWizardToReview,
  installCreationFixtures,
} from "./fixtures";

test("creates one community through mocked wallet, RPC, and registry verification", async ({
  page,
}) => {
  await installCreationFixtures(page);
  await completeWizardToReview(page);

  await page.getByRole("button", { name: "Simulate deployment" }).click();
  await expect(page.getByText(/12345678 stroops \(1\.2345678 XLM\)/)).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve and deploy" });
  await approve.click();
  await approve.click({ force: true }).catch(() => undefined);

  await expect(
    page.getByRole("heading", { name: "Community verified in the registry" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View community" })).toHaveAttribute(
    "href",
    `/communities/${"cc".repeat(32)}`,
  );

  const diagnostics = await page.evaluate(() => window.__STOLLA_E2E__!.diagnostics);
  expect(diagnostics?.submissions).toBe(1);
  expect(diagnostics?.invocations).toHaveLength(1);
  expect(diagnostics?.invocations[0]).toMatchObject({
    contractId: FACTORY_ID,
    method: "create_community",
    sourceAccount: WALLET_ADDRESS,
    networkPassphrase: TESTNET_PASSPHRASE,
    metadata: { name: "Creator Guild", symbol: "CREATE" },
    governance: {
      proposalThreshold: "1",
      quorum: "1",
      votingDelay: "1",
      votingPeriod: "10000",
    },
  });
});

test("wallet rejection returns to recoverable review without submission", async ({
  page,
}) => {
  await installCreationFixtures(page, "wallet-rejection");
  await completeWizardToReview(page);
  await page.getByRole("button", { name: "Simulate deployment" }).click();
  await page.getByRole("button", { name: "Approve and deploy" }).click();

  await expect(page.getByText(/Wallet approval was declined/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and deploy" })).toBeVisible();
  expect(
    await page.evaluate(() => window.__STOLLA_E2E__!.diagnostics!.submissions),
  ).toBe(0);
});

test("simulation failure prevents wallet signing", async ({ page }) => {
  await installCreationFixtures(page, "simulation-failure");
  await completeWizardToReview(page);
  await page.getByRole("button", { name: "Simulate deployment" }).click();

  await expect(page.getByText(/insufficient transaction resources/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve and deploy" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__STOLLA_E2E__!.diagnostics!.submissions),
  ).toBe(0);
});
