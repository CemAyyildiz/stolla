import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: vi.fn(() => ({
    proposalIds: ["a".repeat(64)],
    loading: false,
    error: null,
    empty: false,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/stellar", () => ({
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  contractIds: { governor: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5J3JQIAKV3" },
  requireContractIds: () => ({
    governor: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5J3JQIAKV3",
  }),
}));

vi.mock("@/lib/contracts", async () => {
  const actual = await vi.importActual("@/lib/contracts");
  return {
    ...actual,
    createGovernorClient: vi.fn(() => ({
      proposal_state: vi.fn().mockResolvedValue({
        result: ProposalState.Pending,
      }),
    })),
  };
});

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    signTransaction: vi.fn(),
    isConnecting: false,
  }),
}));

describe("ProposalsPage - localStorage not required for proposals", () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    vi.restoreAllMocks();
    getItemSpy = vi.spyOn(Storage.prototype, "getItem");
  });

  it("populates proposal list from public discovery without reading localStorage", async () => {
    const ProposalsPage = (await import(
      "@/app/(app)/proposals/page"
    )).default;

    render(<ProposalsPage />);

    const proposalItems = screen.getAllByText("a".repeat(64));

    expect(proposalItems.length).toBeGreaterThan(0);
    expect(getItemSpy).not.toHaveBeenCalled();
  });
});