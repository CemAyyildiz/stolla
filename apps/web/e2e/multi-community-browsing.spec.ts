import { expect, test } from "@playwright/test";
import { communityRegistry, getCommunityBySlug } from "./fixtures/registry";
import { attachRouteDiagnostics } from "./utils/diagnostics";

/**
 * Public, wallet-free multi-community browsing flow.
 *
 * No wallet extension is installed anywhere in this spec — Playwright's
 * default browser context has no injected wallet provider, which is exactly
 * the "public visitor" state this flow needs to cover. All assertions read
 * from the deterministic registry in src/lib/registry.ts (re-exported via
 * ./fixtures/registry) so nothing here depends on live RPC/testnet data.
 */

const [communityA, communityB] = communityRegistry;

test.describe("multi-community public browsing", () => {
  test("browses communities -> proposal history -> proposal detail with canonical URLs and breadcrumbs", async ({
    page,
  }, testInfo) => {
    await test.step("open /communities without a wallet", async () => {
      await page.goto("/communities");
      await expect(page).toHaveURL(/\/communities$/);
      await expect(page.getByTestId("community-list")).toBeVisible();
      // No wallet connected: header shows the connect prompt, not an address.
      await expect(
        page.getByRole("button", { name: /connect wallet/i }),
      ).toBeVisible();
    });

    await test.step("search for and open a community", async () => {
      const searchInput = page.getByTestId("community-search-input");
      await searchInput.fill(communityA.name);
      await expect(page).toHaveURL(/[?&]q=/);

      const cards = page.getByTestId("community-card");
      await expect(cards).toHaveCount(1);
      await expect(cards).toContainText(communityA.name);
      await cards.click();
    });

    await test.step("land on the community's canonical detail route", async () => {
      await expect(page).toHaveURL(
        new RegExp(`/communities/${communityA.slug}$`),
      );
      await expect(page.getByTestId("community-detail")).toHaveAttribute(
        "data-community-slug",
        communityA.slug,
      );
      await expect(page.getByTestId("breadcrumbs")).toContainText(
        "Communities",
      );
      await expect(page.getByTestId("breadcrumbs")).toContainText(
        communityA.name,
      );
      await attachRouteDiagnostics(page, testInfo, {
        expectedCommunity: communityA.slug,
      });
    });

    await test.step("navigate to the scoped proposal history", async () => {
      await page.getByTestId("view-proposals-link").click();
      await expect(page).toHaveURL(
        new RegExp(`/communities/${communityA.slug}/proposals$`),
      );
      await expect(page.getByTestId("community-proposals")).toHaveAttribute(
        "data-community-slug",
        communityA.slug,
      );

      const items = page.getByTestId("proposal-list-item");
      await expect(items).toHaveCount(communityA.proposals.length);
      for (const proposal of communityA.proposals) {
        await expect(items.filter({ hasText: proposal.title })).toHaveCount(
          1,
        );
      }
    });

    await test.step("open a proposal detail and verify scoped context", async () => {
      const targetProposal = communityA.proposals[0];
      await page
        .getByTestId("proposal-list-item")
        .filter({ hasText: targetProposal.title })
        .click();

      await expect(page).toHaveURL(
        new RegExp(
          `/communities/${communityA.slug}/proposals/${targetProposal.id}$`,
        ),
      );
      await expect(page.getByTestId("proposal-detail")).toHaveAttribute(
        "data-community-slug",
        communityA.slug,
      );
      await expect(page.getByTestId("proposal-detail")).toHaveAttribute(
        "data-proposal-id",
        targetProposal.id,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        targetProposal.title,
      );
      await expect(page.getByTestId("proposal-status")).toHaveText(
        targetProposal.status,
      );
      await expect(page.getByTestId("breadcrumbs")).toContainText(
        targetProposal.title,
      );

      await attachRouteDiagnostics(page, testInfo, {
        expectedCommunity: communityA.slug,
        expectedProposal: targetProposal.id,
      });
    });
  });

  test("community search query is URL-backed and survives navigation", async ({
    page,
  }) => {
    await page.goto("/communities");

    const searchInput = page.getByTestId("community-search-input");
    await searchInput.fill(communityB.name);
    await expect(page).toHaveURL(/[?&]q=/);

    // Reload: the server component must re-derive the filtered list from
    // the URL, and the client search box must rehydrate from it too.
    await page.reload();
    await expect(searchInput).toHaveValue(communityB.name);
    await expect(page.getByTestId("community-card")).toHaveCount(1);
    await expect(page.getByTestId("community-card")).toContainText(
      communityB.name,
    );

    // Drill in and back out: the query string must still be there. Wait for
    // the (async, client-side) navigation to actually commit a history
    // entry before going back, otherwise goBack() races the pending push
    // and lands on about:blank instead of the search results.
    await page.getByTestId("community-card").click();
    await expect(page).toHaveURL(new RegExp(`/communities/${communityB.slug}$`));
    await page.goBack();
    await expect(searchInput).toHaveValue(communityB.name);
    await expect(page).toHaveURL(/[?&]q=/);
  });

  test("switching communities never leaks the previous community's proposals, even for shared proposal ids", async ({
    page,
  }, testInfo) => {
    // Both fixture communities intentionally define a proposal with id "1"
    // and different titles, precisely to catch state that leaks across a
    // community switch instead of resetting per-route.
    expect(communityA.proposals[0]?.id).toBe(communityB.proposals[0]?.id);
    expect(communityA.proposals[0]?.title).not.toBe(
      communityB.proposals[0]?.title,
    );

    await page.goto(`/communities/${communityA.slug}/proposals`);
    await expect(page.getByTestId("proposal-list-item")).toHaveCount(
      communityA.proposals.length,
    );
    await expect(
      page.getByTestId("proposal-list-item").first(),
    ).toContainText(communityA.proposals[0].title);

    // Switch communities via the public list rather than editing the URL,
    // matching how a real visitor would navigate.
    await page.goto("/communities");
    await page
      .getByTestId("community-card")
      .filter({ hasText: communityB.name })
      .click();
    await page.getByTestId("view-proposals-link").click();

    await expect(page).toHaveURL(
      new RegExp(`/communities/${communityB.slug}/proposals$`),
    );
    const itemsB = page.getByTestId("proposal-list-item");
    await expect(itemsB).toHaveCount(communityB.proposals.length);
    await expect(
      itemsB.filter({ hasText: communityA.proposals[0].title }),
    ).toHaveCount(0);
    await expect(itemsB.first()).toContainText(communityB.proposals[0].title);

    // Same proposal id ("1"), different community: must resolve to
    // community B's proposal, never community A's.
    await itemsB.first().click();
    await expect(page).toHaveURL(
      new RegExp(`/communities/${communityB.slug}/proposals/1$`),
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      communityB.proposals[0].title,
    );
    await expect(page.getByTestId("proposal-detail")).toHaveAttribute(
      "data-community-slug",
      communityB.slug,
    );

    await attachRouteDiagnostics(page, testInfo, {
      sharedProposalId: "1",
      resolvedCommunity: communityB.slug,
      resolvedTitle: communityB.proposals[0].title,
    });
  });

  test("breadcrumb navigation collapses responsively without losing context", async ({
    page,
  }) => {
    const proposal = getCommunityBySlug(communityA.slug)?.proposals[0];
    if (!proposal) throw new Error("fixture missing proposal for communityA");

    await page.goto(
      `/communities/${communityA.slug}/proposals/${proposal.id}`,
    );

    const breadcrumbs = page.getByTestId("breadcrumbs");
    const currentCrumb = breadcrumbs.getByTestId("breadcrumb-item").last();
    await expect(currentCrumb).toContainText(proposal.title);

    const viewport = page.viewportSize();
    const isMobile = (viewport?.width ?? 1280) < 640;
    const communityCrumbLink = breadcrumbs.getByRole("link", {
      name: communityA.name,
    });

    if (isMobile) {
      // Middle crumbs collapse on narrow viewports; the root + current
      // crumb must remain reachable.
      await expect(communityCrumbLink).toBeHidden();
    } else {
      await expect(communityCrumbLink).toBeVisible();
      await communityCrumbLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/communities/${communityA.slug}$`),
      );
    }

    await expect(
      breadcrumbs.getByRole("link", { name: "Communities" }),
    ).toBeVisible();
  });
});
