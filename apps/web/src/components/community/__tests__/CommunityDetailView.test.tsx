import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityDetailView } from "@/components/community/CommunityDetailView";
import {
  atlasCommunity,
  atlasMetadata,
  beaconCommunity,
  beaconMetadata,
  createFetchMetadata,
  driftwoodCommunity,
  multiCommunityRegistry,
} from "@/test/fixtures/communities";

const fetchMetadata = createFetchMetadata({
  [atlasCommunity.metadataUri!]: atlasMetadata,
  [beaconCommunity.metadataUri!]: beaconMetadata,
});

describe("CommunityDetailView route resolution", () => {
  it("selects the correct registry record for the routed community id", async () => {
    render(
      <CommunityDetailView
        communityId={beaconCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: beaconCommunity.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(beaconCommunity.governorContractId)).toBeInTheDocument();
    expect(screen.getByText(beaconCommunity.nftContractId)).toBeInTheDocument();
    // Must not render the other community's on-chain data.
    expect(screen.queryByText(atlasCommunity.governorContractId)).not.toBeInTheDocument();
  });

  it("renders canonical breadcrumb links for the resolved community", async () => {
    render(
      <CommunityDetailView
        communityId={atlasCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );

    await screen.findByRole("heading", { name: atlasCommunity.name });

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Communities" })).toHaveAttribute(
      "href",
      "/community",
    );
    expect(within(nav).getByText(atlasCommunity.name)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders a canonical scoped proposal link for the resolved community", async () => {
    render(
      <CommunityDetailView
        communityId={atlasCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );

    const link = await screen.findByRole("link", { name: "View proposals" });
    expect(link).toHaveAttribute("href", `/community/${atlasCommunity.id}/proposals`);
  });

  it("produces not-found behavior for an unknown community id", () => {
    render(
      <CommunityDetailView
        communityId="does-not-exist"
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );

    expect(screen.getByText("Community not found")).toBeInTheDocument();
    expect(screen.getByText("does-not-exist")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: atlasCommunity.name }),
    ).not.toBeInTheDocument();
  });

  it("preserves on-chain identifiers and navigation when metadata fails to load", async () => {
    render(
      <CommunityDetailView
        communityId={driftwoodCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: driftwoodCommunity.name }),
    ).toBeInTheDocument();
    // On-chain identifiers still render even though there is no metadataUri.
    expect(screen.getByText(driftwoodCommunity.governorContractId)).toBeInTheDocument();
    expect(screen.getByText(driftwoodCommunity.nftContractId)).toBeInTheDocument();
    // Navigation (breadcrumbs, proposals link) still works.
    expect(screen.getByRole("link", { name: "View proposals" })).toHaveAttribute(
      "href",
      `/community/${driftwoodCommunity.id}/proposals`,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Community details are temporarily unavailable/i),
      ).toBeInTheDocument(),
    );
  });

  it("preserves on-chain identifiers and navigation when the metadata fetch itself rejects", async () => {
    const failingFetch = createFetchMetadata({
      [atlasCommunity.metadataUri!]: new Error("network down"),
    });

    render(
      <CommunityDetailView
        communityId={atlasCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={failingFetch}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: atlasCommunity.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(atlasCommunity.governorContractId)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/Community details are temporarily unavailable/i),
      ).toBeInTheDocument(),
    );
  });

  it("keeps breadcrumb links keyboard reachable and activatable", async () => {
    const user = userEvent.setup();
    render(
      <CommunityDetailView
        communityId={atlasCommunity.id}
        registry={multiCommunityRegistry}
        fetchMetadata={fetchMetadata}
      />,
    );
    await screen.findByRole("heading", { name: atlasCommunity.name });

    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Communities" })).toHaveFocus();
  });
});
