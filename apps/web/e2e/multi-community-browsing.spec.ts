import { expect, test } from "@playwright/test";
import {
  ALPHA_ID,
  BETA_ID,
  PROPOSAL_ID,
  installPublicFixtures,
} from "./fixtures";

const ALPHA_NAME = "Alpha Builders";
const BETA_NAME = "Beta Citizens";
const ALPHA_PROPOSAL = "Alpha treasury proposal";
const BETA_PROPOSAL = "Beta grants proposal";

test.beforeEach(async ({ page }) => {
  await installPublicFixtures(page);
});

test.describe("multi-community public browsing", () => {
  test("browses registry, scoped proposal history, and canonical detail routes", async ({
    page,
  }) => {
    await page.goto("/communities");
    await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /connect wallet/i }),
    ).toBeVisible();

    await page.getByLabel("Search communities by name").fill(ALPHA_NAME);
    await expect(page).toHaveURL(/[?&]q=Alpha(?:\+|%20)Builders/);
    await page
      .getByRole("link", { name: `View ${ALPHA_NAME} community details` })
      .click();

    await expect(page).toHaveURL(`/communities/${ALPHA_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: ALPHA_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: "← All communities" })).toBeVisible();

    await page.getByRole("link", { name: "View community proposals" }).click();
    await expect(page).toHaveURL(`/communities/${ALPHA_ID}/proposals`);
    await expect(
      page.getByRole("heading", { name: `${ALPHA_NAME} proposals` }),
    ).toBeVisible();
    await expect(page.getByText(ALPHA_PROPOSAL)).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(`View proposal ${PROPOSAL_ID}`) })
      .click();
    await expect(page).toHaveURL(
      `/communities/${ALPHA_ID}/proposals/${PROPOSAL_ID}`,
    );
    await expect(page.getByRole("heading", { name: "Proposal" })).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toContainText(ALPHA_NAME);
    await expect(breadcrumb).toContainText("Proposals");
  });

  test("community search query is URL-backed and survives navigation", async ({
    page,
  }) => {
    await page.goto("/communities");
    const searchInput = page.getByLabel("Search communities by name");
    await searchInput.fill(BETA_NAME);
    await expect(page).toHaveURL(/[?&]q=Beta(?:\+|%20)Citizens/);

    await page.reload();
    await expect(searchInput).toHaveValue(BETA_NAME);
    await expect(
      page.getByRole("link", { name: `View ${BETA_NAME} community details` }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: `View ${BETA_NAME} community details` })
      .click();
    await expect(page).toHaveURL(`/communities/${BETA_ID}`);
    await page.goBack();
    await expect(searchInput).toHaveValue(BETA_NAME);
    await expect(page).toHaveURL(/[?&]q=/);
  });

  test("switching communities never leaks proposals with a shared id", async ({
    page,
  }) => {
    await page.goto(`/communities/${ALPHA_ID}/proposals`);
    await expect(page.getByText(ALPHA_PROPOSAL)).toBeVisible();
    await expect(page.getByText(BETA_PROPOSAL)).toHaveCount(0);

    await page.goto("/communities");
    await page
      .getByRole("link", { name: `View ${BETA_NAME} community details` })
      .click();
    await page.getByRole("link", { name: "View community proposals" }).click();

    await expect(page).toHaveURL(`/communities/${BETA_ID}/proposals`);
    await expect(page.getByText(BETA_PROPOSAL)).toBeVisible();
    await expect(page.getByText(ALPHA_PROPOSAL)).toHaveCount(0);
    await page
      .getByRole("link", { name: new RegExp(`View proposal ${PROPOSAL_ID}`) })
      .click();
    await expect(page).toHaveURL(
      `/communities/${BETA_ID}/proposals/${PROPOSAL_ID}`,
    );
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText(BETA_NAME);
  });

  test("breadcrumb context remains reachable at mobile and desktop widths", async ({
    page,
  }) => {
    await page.goto(`/communities/${ALPHA_ID}/proposals/${PROPOSAL_ID}`);
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: ALPHA_NAME })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Proposals" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBe(dimensions.client);
  });
});
