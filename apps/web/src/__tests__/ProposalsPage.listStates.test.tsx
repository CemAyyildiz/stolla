import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  discovery: vi.fn(),
  createGovernorClient: vi.fn(),
}));

vi.mock("@/hooks/useProposalDiscovery", () => ({
  useProposalDiscovery: mocks.discovery,
}));
vi.mock("@/lib/stellar", () => ({
  contractIds: { governor: "CGOVERNOR" },
  requireContractIds: () => ({ governor: "CGOVERNOR", nft: "CNFT" }),
}));
vi.mock("@/lib/contracts", () => ({
  createGovernorClient: mocks.createGovernorClient,
  storeProposalId: vi.fn(),
}));
vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    signTransaction: vi.fn(),
  }),
}));

import ProposalsPage from "@/app/(app)/proposals/page";

const ACTIVE = 1;
const proposal = (index: number) => ({
  id: index.toString(16).padStart(64, "0"),
  description: `Proposal ${index}`,
});

describe("ProposalsPage public list states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({ result: ACTIVE }),
    });
  });

  it("keeps initial loading distinct from genuine empty history", () => {
    mocks.discovery.mockReturnValue({
      proposals: [],
      proposalIds: [],
      loading: true,
      error: null,
      empty: false,
      refresh: vi.fn(),
    });
    const { rerender } = render(<ProposalsPage />);
    expect(screen.getByText("Loading proposal history...")).toBeInTheDocument();
    expect(
      screen.queryByText("No public proposals have been discovered yet."),
    ).not.toBeInTheDocument();

    mocks.discovery.mockReturnValue({
      proposals: [],
      proposalIds: [],
      loading: false,
      error: null,
      empty: true,
      refresh: vi.fn(),
    });
    rerender(<ProposalsPage />);
    expect(
      screen.getByText("No public proposals have been discovered yet."),
    ).toBeInTheDocument();
  });

  it("appends visible cards without duplicate proposal IDs", async () => {
    const proposals = Array.from({ length: 12 }, (_, index) =>
      proposal(index + 1),
    );
    mocks.discovery.mockReturnValue({
      proposals,
      proposalIds: [...proposals.map(({ id }) => id), proposals[0].id],
      loading: false,
      error: null,
      empty: false,
      refresh: vi.fn(),
    });
    render(<ProposalsPage />);

    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /Active/ })).toHaveLength(10),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByRole("link", { name: /Active/ })).toHaveLength(12);
    expect(screen.getAllByTitle(proposals[0].id)).toHaveLength(1);
  });

  it("preserves successful entries during partial and next-page failures", async () => {
    const first = proposal(20);
    const failed = proposal(21);
    mocks.createGovernorClient.mockReturnValue({
      proposal_state: vi
        .fn()
        .mockResolvedValueOnce({ result: ACTIVE })
        .mockRejectedValueOnce(new Error("state unavailable")),
    });
    mocks.discovery.mockReturnValue({
      proposals: [first, failed],
      proposalIds: [first.id, failed.id],
      loading: false,
      error: "The next proposal page timed out.",
      empty: false,
      refresh: vi.fn(),
    });
    render(<ProposalsPage />);

    expect(
      await screen.findByText("More proposal history could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Active/ })).toHaveAttribute(
      "href",
      `/proposals/${first.id}`,
    );
    expect(screen.getByRole("link", { name: /Unavailable/ })).toHaveAttribute(
      "href",
      `/proposals/${failed.id}`,
    );
  });
});
