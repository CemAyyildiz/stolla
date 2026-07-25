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

type MobileHeaderContractState = {
  headerWraps: boolean;
  leftGroupContainsOverflow: boolean;
  navigationKeepsWidth: boolean;
};

async function readMobileHeaderContract(
  page: Page,
): Promise<MobileHeaderContractState> {
  return page.evaluate(() => {
    const headerRow = document.querySelector<HTMLElement>(
      "header.sticky > div",
    );
    const leftGroup = document.querySelector<HTMLElement>(
      "header.sticky > div > div:first-child",
    );
    const navigation = document.querySelector<HTMLElement>(
      "header.sticky nav",
    );

    if (!headerRow || !leftGroup || !navigation) {
      throw new Error("The application header contract could not be inspected");
    }

    return {
      headerWraps: getComputedStyle(headerRow).flexWrap === "wrap",
      leftGroupContainsOverflow:
        getComputedStyle(leftGroup).overflowX === "auto",
      navigationKeepsWidth: getComputedStyle(navigation).flexShrink === "0",
    };
  });
}

async function installTemporaryIssue2DependencyMock(page: Page) {
  // REQUIRED CLEANUP (#2 / #109): when the real responsive contract reaches
  // main, remove this helper and its call. The smoke test must then run against
  // the production header without injected styles.
  const upstreamState = await readMobileHeaderContract(page);
  const upstreamContractIsReady = Object.values(upstreamState).every(Boolean);

  if (upstreamContractIsReady) {
    throw new Error(
      "#2 / #109 is present: remove the temporary dependency mock and run this smoke test against the real header",
    );
  }

  await page.addStyleTag({ content: ISSUE_2_MOBILE_HEADER_CONTRACT });

  await expect
    .poll(() => readMobileHeaderContract(page))
    .toEqual({
      headerWraps: true,
      leftGroupContainsOverflow: true,
      navigationKeepsWidth: true,
    });
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
  await installTemporaryIssue2DependencyMock(page);

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
