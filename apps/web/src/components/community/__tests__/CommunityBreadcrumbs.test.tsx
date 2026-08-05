import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityBreadcrumbs } from "@/components/community/CommunityBreadcrumbs";

describe("CommunityBreadcrumbs", () => {
  it("renders Home / Communities / community without a proposal segment", () => {
    render(
      <CommunityBreadcrumbs communityId="atlas-collective" communityName="Atlas Collective" />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Communities"]);
    expect(within(nav).getByText("Atlas Collective")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("appends a scoped proposal segment when a proposal id is given", () => {
    render(
      <CommunityBreadcrumbs
        communityId="atlas-collective"
        communityName="Atlas Collective"
        proposalId="01"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Atlas Collective" })).toHaveAttribute(
      "href",
      "/community/atlas-collective",
    );
    expect(within(nav).getByText("Proposal #01")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is keyboard navigable in document order", async () => {
    const user = userEvent.setup();
    render(
      <CommunityBreadcrumbs
        communityId="atlas-collective"
        communityName="Atlas Collective"
        proposalId="01"
      />,
    );

    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Communities" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Atlas Collective" })).toHaveFocus();
  });
});
