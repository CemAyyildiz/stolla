import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunitySwitcher } from "@/components/community/CommunitySwitcher";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityRegistry,
} from "@/test-support/stellar";

describe("CommunitySwitcher", () => {
  it("links to every registered community with correct hrefs", () => {
    render(
      <CommunitySwitcher
        communities={multiCommunityRegistry}
        activeCommunityId={atlasCommunity.id}
      />,
    );

    for (const community of multiCommunityRegistry) {
      expect(screen.getByRole("link", { name: community.name })).toHaveAttribute(
        "href",
        `/community/${community.id}`,
      );
    }
  });

  it("marks only the active community as current", () => {
    render(
      <CommunitySwitcher
        communities={multiCommunityRegistry}
        activeCommunityId={beaconCommunity.id}
      />,
    );

    expect(screen.getByRole("link", { name: beaconCommunity.name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: atlasCommunity.name }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing when no communities are registered", () => {
    const { container } = render(
      <CommunitySwitcher communities={[]} activeCommunityId={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is fully keyboard reachable in registry order", async () => {
    const user = userEvent.setup();
    render(
      <CommunitySwitcher
        communities={multiCommunityRegistry}
        activeCommunityId={atlasCommunity.id}
      />,
    );

    for (const community of multiCommunityRegistry) {
      await user.tab();
      expect(screen.getByRole("link", { name: community.name })).toHaveFocus();
    }
  });
});
