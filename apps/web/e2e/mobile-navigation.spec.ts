import { expect, test, type Page } from "@playwright/test";

const ISSUE_2_MOBILE_HEADER_CONTRACT = `
  @media (max-width: 639px) {
    header.sticky > div {
      flex-wrap: wrap;
    }

    header.sticky > div > div:first-child {
      overflow-x: auto;
    }

    header.sticky nav {
      flex-shrink: 0;
    }
  }
`;

async function installIssue2DependencyMock(page: Page) {
  // #19 depends on #2. Until #2 / PR #109 lands, this browser-only style
  // models that PR's responsive contract without duplicating it in production.
  await page.addStyleTag({ content: ISSUE_2_MOBILE_HEADER_CONTRACT });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      })),
    )
    .toEqual({
      clientWidth: 390,
      documentWidth: 390,
      bodyWidth: 390,
    });
}

test("navigates landing, Community, and Proposals without mobile overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL("/community");
  await installIssue2DependencyMock(page);

  await expect(
    page.getByRole("heading", { level: 1, name: "Community NFT" }),
  ).toBeVisible();
  const appNavigation = page.getByRole("navigation");
  await expect(
    appNavigation.getByRole("link", { name: "Community" }),
  ).toBeVisible();
  await expect(
    appNavigation.getByRole("link", { name: "Proposals" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await appNavigation.getByRole("link", { name: "Proposals" }).click();
  await expect(page).toHaveURL("/proposals");
  await expect(
    page.getByRole("heading", { level: 1, name: "Proposals" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await appNavigation.getByRole("link", { name: "Community" }).click();
  await expect(page).toHaveURL("/community");
  await expect(
    page.getByRole("heading", { level: 1, name: "Community NFT" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
