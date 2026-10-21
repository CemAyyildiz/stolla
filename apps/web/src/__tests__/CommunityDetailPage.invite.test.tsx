/**
 * Covers issue #407: the invite banner on the community detail page, and
 * that the invite flag never influences owner/guardian authorization.
 *
 * A separate file from CommunityDetailPage.test.tsx because that file does
 * not mock @/context/WalletProvider, and the real module currently fails to
 * load under vitest (a pre-existing @stellar/freighter-api CJS/ESM interop
 * issue, reproduces on a clean main checkout — unrelated to this change).
 * CommunityInviteBanner imports useWallet, so this file mocks
 * WalletProvider the same way activity/page.test.tsx already does.
 */
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";
import type { CommunityDetailResult } from "@/lib/community/types";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getCommunity: vi.fn(),
  wallet: { address: null as string | null, connect: vi.fn(), isConnecting: false },
  ownershipSettingsProps: vi.fn(),
  guardianControlsProps: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: mocks.useParams }));
vi.mock("@/context/WalletProvider", () => ({ useWallet: () => mocks.wallet }));
vi.mock("@/components/community/CommunityMemberRoster", () => ({
  CommunityMemberRoster: () => <div data-testid="community-member-roster" />,
}));
vi.mock("@/components/community/GuardianControls", () => ({
  GuardianControls: (props: unknown) => {
    mocks.guardianControlsProps(props);
    return <div data-testid="guardian-controls" />;
  },
}));
vi.mock("@/components/community/CommunityOwnershipSettings", () => ({
  CommunityOwnershipSettings: (props: unknown) => {
    mocks.ownershipSettingsProps(props);
    return <div data-testid="community-ownership-settings" />;
  },
}));

import CommunityDetailPage from "@/app/(app)/communities/[id]/page";

const COMMUNITY_ID = "ab".repeat(32);

const foundResult: CommunityDetailResult = {
  status: "found",
  community: {
    record: {
      id: COMMUNITY_ID,
      nftContract: "CA".padEnd(56, "A"),
      governorContract: "CB".padEnd(56, "B"),
      creator: "GC".padEnd(56, "C"),
      communityOwner: "GO".padEnd(56, "O"),
      timelockContract: "CT".padEnd(56, "T"),
      createdAtLedger: 100,
      creationIndex: 1,
      metadataUri: "https://example.test/community.json",
      metadataHash: "cd".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: { schemaVersion: 1, name: "Builders Guild", description: "", externalLinks: [] },
    metadataError: null,
    governance: {
      votingDelay: 10,
      votingPeriod: 100,
      proposalThreshold: "1",
      quorum: "10",
      unavailableFields: [],
    },
  },
};

const registry = { list: vi.fn(), get: vi.fn() };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityDetailPage />
    </CommunityRegistryProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useParams.mockReturnValue({ id: COMMUNITY_ID });
  mocks.wallet.address = null;
  registry.get.mockResolvedValue(foundResult);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  window.history.pushState({}, "", `/communities/${COMMUNITY_ID}`);
});

describe("CommunityDetailPage invite banner", () => {
  it("shows the invite banner and a connect-wallet CTA when ?invite=1 and disconnected", async () => {
    window.history.pushState({}, "", `/communities/${COMMUNITY_ID}?invite=1`);
    await act(async () => {
      renderPage();
    });

    expect(await screen.findByText("You've been invited to Builders Guild")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("does not show the invite banner without the query param", async () => {
    await act(async () => {
      renderPage();
    });
    await screen.findByText("Builders Guild");
    expect(screen.queryByRole("status", { name: "Community invite" })).not.toBeInTheDocument();
  });

  it("does not show the invite banner for an invalid invite value", async () => {
    window.history.pushState({}, "", `/communities/${COMMUNITY_ID}?invite=true`);
    await act(async () => {
      renderPage();
    });
    await screen.findByText("Builders Guild");
    expect(screen.queryByRole("status", { name: "Community invite" })).not.toBeInTheDocument();
  });

  it("renders the invite link builder on the page", async () => {
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByLabelText("Community invite link")).toHaveValue(
      `${window.location.origin}/communities/${COMMUNITY_ID}?invite=1`,
    );
  });

  it("does not grant owner powers via the invite flag: an unconnected wallet with ?invite=1 still sees no owner/guardian controls unlocked", async () => {
    window.history.pushState({}, "", `/communities/${COMMUNITY_ID}?invite=1`);
    mocks.wallet.address = null; // explicit: disconnected, and NOT the community's owner
    await act(async () => {
      renderPage();
    });

    await screen.findByText("You've been invited to Builders Guild");
    expect(screen.getByTestId("community-ownership-settings")).toBeInTheDocument();
    expect(screen.getByTestId("guardian-controls")).toBeInTheDocument();

    // The strongest guarantee: the page never threads the invite flag, or
    // anything derived from it, into either authorization-sensitive
    // component's props. Both gate solely on the connected wallet address
    // against on-chain state (see CommunityOwnershipSettings.tsx,
    // GuardianControls.tsx) — there is no "invite" field for them to read
    // even if they wanted to.
    const ownershipProps = mocks.ownershipSettingsProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const guardianProps = mocks.guardianControlsProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(Object.keys(ownershipProps).map((k) => k.toLowerCase())).not.toContain("invite");
    expect(Object.keys(guardianProps).map((k) => k.toLowerCase())).not.toContain("invite");
    expect(JSON.stringify(ownershipProps)).not.toMatch(/invite/i);
    expect(JSON.stringify(guardianProps)).not.toMatch(/invite/i);
  });
});
