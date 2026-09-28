import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityDetailResult } from "@/lib/community/types";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  loadCommunityData: vi.fn(),
  getCommunity: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));
vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));
vi.mock("@/lib/stellar", () => ({
  contractIds: { nft: "CGLOBAL", governor: "CGOV" },
}));
vi.mock("@/app/(app)/community/community-data.mjs", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/app/(app)/community/community-data.mjs")
  >();
  return { ...actual, loadCommunityData: mocks.loadCommunityData };
});

import CommunityPage from "@/app/(app)/community/page";
import {
  MOCK_ACCOUNT_CAROL,
  MOCK_ACCOUNT_OWNER,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
  MOCK_GOVERNOR_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const registry = { list: vi.fn(), get: mocks.getCommunity };

function renderPage() {
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunityPage />
    </CommunityRegistryProvider>,
  );
}

function result(id: string, nftContract: string, name: string): CommunityDetailResult {
  return {
    status: "found",
    community: {
      record: {
        id,
        nftContract,
        governorContract: MOCK_GOVERNOR_CONTRACT_ID,
        creator: MOCK_ACCOUNT_CAROL,
        communityOwner: MOCK_ACCOUNT_OWNER,
        createdAtLedger: 1,
        creationIndex: 1,
        metadataUri: "https://example.test/community.json",
        metadataHash: "ab".repeat(32),
        metadataSchemaVersion: 1,
      },
      metadata: {
        schemaVersion: 1,
        name,
        description: "Community",
        externalLinks: [],
      },
      metadataError: null,
      governance: {
        votingDelay: 1,
        votingPeriod: 10,
        proposalThreshold: "1",
        quorum: "1",
        unavailableFields: [],
      },
    },
  };
}

describe("CommunityPage selected-community contract scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
    });
    mocks.createReadOnlyNftClient.mockReturnValue({});
    mocks.loadCommunityData.mockResolvedValue({
      name: "Collection",
      symbol: "NFT",
      balance: null,
      votes: null,
    });
  });

  it("binds reads to each NFT address from the canonical registry", async () => {
    const firstId = "ab".repeat(32);
    const secondId = "cd".repeat(32);
    const firstContract = MOCK_CONTRACT_A;
    const secondContract = MOCK_CONTRACT_B;
    mocks.getCommunity.mockImplementation((id: string) =>
      Promise.resolve(
        id === firstId
          ? result(firstId, firstContract, "First DAO")
          : result(secondId, secondContract, "Second DAO"),
      ),
    );

    window.history.replaceState({}, "", `/community?community=${firstId}`);
    const first = renderPage();
    expect(await screen.findByText("First DAO")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.createReadOnlyNftClient).toHaveBeenCalledWith(firstContract),
    );
    first.unmount();

    window.history.replaceState({}, "", `/community?community=${secondId}`);
    renderPage();
    expect(await screen.findByText("Second DAO")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.createReadOnlyNftClient).toHaveBeenCalledWith(secondContract),
    );
  });
});
