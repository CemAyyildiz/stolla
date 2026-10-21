/**
 * Covers issue #405: skip link + landmark/heading audit across the primary
 * app templates (communities list/detail/proposals/settings, proposals
 * list, legacy community, activity).
 */
import { expect, test, type Page } from "@playwright/test";
import { ALPHA_ID, PROPOSAL_ID, installPublicFixtures } from "./fixtures";

const AUDITED_ROUTES = [
  "/communities",
  `/communities/${ALPHA_ID}`,
  `/communities/${ALPHA_ID}/proposals`,
  `/communities/${ALPHA_ID}/proposals/${PROPOSAL_ID}`,
  `/communities/${ALPHA_ID}/settings`,
  "/proposals",
  "/community",
  "/activity",
];

test.beforeEach(async ({ page }) => {
  await installPublicFixtures(page);
});

async function headingLevels(page: Page): Promise<number[]> {
  return page.$$eval("h1,h2,h3,h4,h5,h6", (nodes) =>
    nodes.map((node) => Number(node.tagName.slice(1))),
  );
}

for (const path of AUDITED_ROUTES) {
  test(`${path} exposes exactly one main landmark`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test(`${path} does not skip a heading level`, async ({ page }) => {
    await page.goto(path);
    // Wait for the page's own h1 so a brief client-render/loading flash
    // (e.g. a data fetch resolving) isn't snapshotted mid-transition.
    await expect(page.locator("h1").first()).toBeVisible();

    const levels = await headingLevels(page);
    expect(levels.length, `${path} should render at least one heading`).toBeGreaterThan(0);

    let maxSeen = 0;
    for (const level of levels) {
      expect(
        level,
        `${path}: heading <h${level}> appears after the deepest level seen so far was h${maxSeen}, skipping a level`,
      ).toBeLessThanOrEqual(maxSeen + 1);
      maxSeen = Math.max(maxSeen, level);
    }
  });
}

test("skip link is visually hidden until focused, then moves focus into main", async ({ page }) => {
  await page.goto("/communities");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });

  // Off-screen above the viewport until focused (see .skip-link in globals.css).
  const hiddenBox = await skipLink.boundingBox();
  expect(hiddenBox, "skip link should still be in the DOM").not.toBeNull();
  expect(hiddenBox!.y).toBeLessThan(0);

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  // .skip-link's reveal is a 150ms CSS transition (see globals.css), so poll
  // for the settled position rather than reading the box immediately.
  await expect
    .poll(async () => (await skipLink.boundingBox())!.y, {
      message: "skip link should animate into view once focused",
    })
    .toBeGreaterThanOrEqual(0);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
