import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import {
  clearStellarMockRegistry,
  createGovernorClientMock,
  createNftClientMock,
  createWalletMock,
  rejected,
  resolved,
  sequence,
  type GovernorClientMock,
  type NftClientMock,
} from "@/test-support/stellar";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useWallet: vi.fn(),
  createGovernorClient: vi.fn(),
  createReadOnlyGovernorClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  fetchVoteTotals: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: mocks.useParams }));
vi.mock("@/context/WalletProvider", () => ({ useWallet: mocks.useWallet }));
vi.mock("@/lib/contracts", () => ({
  createGovernorClient: mocks.createGovernorClient,
  createReadOnlyGovernorClient: mocks.createReadOnlyGovernorClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));
vi.mock("@/lib/voteAggregation", () => ({
  fetchVoteTotals: mocks.fetchVoteTotals,
}));
vi.mock("@/lib/stellar", async () => {
  const { createNetworkFixture } = await import(
    "@/test-support/stellar/network"
  );
  return createNetworkFixture({
    governorContractId: "CGOV",
    nftContractId: "CNFT",
  });
});

import ProposalDetailPage from "@/app/(app)/proposals/[id]/page";

const VALID_ID = "ab".repeat(32);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let readOnlyGovernor: GovernorClientMock;
let walletGovernor: GovernorClientMock;
let nft: NftClientMock;

function mockWallet() {
  mocks.useWallet.mockReturnValue(createWalletMock());
}

function mockVoteTotals() {
  mocks.fetchVoteTotals.mockResolvedValue({
    totals: {
      for: BigInt(0),
      against: BigInt(0),
      abstain: BigInt(0),
      total: BigInt(0),
    },
    incomplete: false,
  });
}

function mockConnectedWallet(address = "GWALLET") {
  mocks.useWallet.mockReturnValue(createWalletMock({ address }));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearStellarMockRegistry();
  readOnlyGovernor = createGovernorClientMock({
    proposal_state: resolved(ProposalState.Active),
    proposal_snapshot: resolved(1_500_000),
    proposal_deadline: resolved(2_000_000),
    proposal_proposer: resolved("GPROPOSER"),
    quorum: resolved(BigInt(100)),
  });
  walletGovernor = createGovernorClientMock({
    has_voted: resolved(false),
    quorum: resolved(BigInt(100)),
  });
  nft = createNftClientMock({ get_votes: resolved(BigInt(3)) });
  mocks.createReadOnlyGovernorClient.mockImplementation(() => readOnlyGovernor);
  mocks.createGovernorClient.mockImplementation(() => walletGovernor);
  mocks.createReadOnlyNftClient.mockImplementation(() => nft);
  mockWallet();
  mockVoteTotals();
});

describe("ProposalDetailPage", () => {
  it("rejects non-hexadecimal IDs before any RPC request", async () => {
    mocks.useParams.mockReturnValue({ id: "not-hex-at-all" });
    render(<ProposalDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Invalid proposal ID" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to proposals" })).toHaveAttribute(
      "href",
      "/proposals",
    );
    expect(mocks.createGovernorClient).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Cast vote" })).not.toBeInTheDocument();
  });

  it("rejects truncated hex IDs", async () => {
    mocks.useParams.mockReturnValue({ id: "ab".repeat(16) });
    render(<ProposalDetailPage />);
    expect(
      await screen.findByRole("heading", { name: "Invalid proposal ID" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to proposals" })).toHaveAttribute(
      "href",
      "/proposals",
    );
  });

  it("rejects oversized hex IDs", async () => {
    mocks.useParams.mockReturnValue({ id: "ab".repeat(33) });
    render(<ProposalDetailPage />);
    expect(
      await screen.findByRole("heading", { name: "Invalid proposal ID" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to proposals" })).toHaveAttribute(
      "href",
      "/proposals",
    );
  });

  it("renders an unavailable state for well-formed unknown IDs", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    readOnlyGovernor.set("proposal_state", rejected("Contract error"));

    render(<ProposalDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Proposal unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to proposals" })).toHaveAttribute(
      "href",
      "/proposals",
    );
    expect(screen.queryByRole("heading", { name: "Cast vote" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Contract error/)).not.toBeInTheDocument();
  });

  it("renders vote controls for a valid known proposal", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });

    render(<ProposalDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Cast vote" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Active")).toBeInTheDocument(),
    );
  });

  it("shows snapshot and deadline ledger numbers for a valid proposal", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    readOnlyGovernor.set("proposal_snapshot", resolved(1_500_000));
    readOnlyGovernor.set("proposal_deadline", resolved(2_000_000));

    render(<ProposalDetailPage />);

    expect(await screen.findByText("1500000")).toBeInTheDocument();
    expect(screen.getByText("2000000")).toBeInTheDocument();
    expect(readOnlyGovernor.proposal_snapshot.callCount()).toBe(1);
    expect(readOnlyGovernor.proposal_deadline.callCount()).toBe(1);
    const snapshotArg = readOnlyGovernor.proposal_snapshot.lastArgs()!;
    const deadlineArg = readOnlyGovernor.proposal_deadline.lastArgs()!;
    // Vitest/jsdom can expose Buffer instances that fail Buffer.isBuffer across realms.
    expect(snapshotArg.proposal_id).toBeInstanceOf(Uint8Array);
    expect(deadlineArg.proposal_id).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(snapshotArg.proposal_id).toString("hex")).toBe(VALID_ID);
    expect(Buffer.from(deadlineArg.proposal_id).toString("hex")).toBe(VALID_ID);
  });

  it("keeps proposal state visible when deadline read fails", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    readOnlyGovernor.set("proposal_deadline", rejected("deadline boom"));

    render(<ProposalDetailPage />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("1500000")).toBeInTheDocument();
  });

  it("ignores a stale response after navigating to another proposal", async () => {
    const firstId = "ab".repeat(32);
    const secondId = "cd".repeat(32);
    let currentId = firstId;
    const firstResponse = deferred<ProposalState>();
    const secondResponse = deferred<ProposalState>();

    mocks.useParams.mockImplementation(() => ({ id: currentId }));
    readOnlyGovernor.set(
      "proposal_state",
      sequence(
        () => firstResponse.promise,
        () => secondResponse.promise,
      ),
    );

    const { rerender } = render(<ProposalDetailPage />);
    currentId = secondId;
    rerender(<ProposalDetailPage />);

    await act(async () => {
      secondResponse.resolve(ProposalState.Active);
    });
    expect(await screen.findByText("Active")).toBeInTheDocument();

    await act(async () => {
      firstResponse.resolve(ProposalState.Pending);
    });
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Loading proposal…")).not.toBeInTheDocument();
  });

  it("asks disconnected users to connect instead of showing zero voting power", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    render(<ProposalDetailPage />);

    expect(
      await screen.findByText("Connect your wallet to view voting power."),
    ).toBeInTheDocument();
    expect(mocks.createReadOnlyNftClient).not.toHaveBeenCalled();
    expect(screen.queryByText("Delegate your membership NFT")).not.toBeInTheDocument();
  });

  it("shows a loading state while voting power is fetched", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    const pending = deferred<bigint>();
    nft.set("get_votes", () => pending.promise);

    render(<ProposalDetailPage />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    const votingPowerLabel = screen.getByText("Your voting power");
    const votingPowerValue = votingPowerLabel.parentElement;
    expect(votingPowerValue?.textContent).not.toMatch(/\b0\b/);
    expect(votingPowerValue?.textContent).not.toContain(
      "Connect your wallet to view voting power.",
    );
    expect(votingPowerValue?.querySelector("[aria-hidden='true']")).toBeTruthy();

    await act(async () => {
      pending.resolve(BigInt(7));
    });
    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("shows exact positive voting power without precision loss", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    const power = BigInt("9007199254740993");
    nft.set("get_votes", resolved(power));

    render(<ProposalDetailPage />);

    expect(await screen.findByText(power.toString())).toBeInTheDocument();
  });

  it("guides users when voting power is zero", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    nft.set("get_votes", resolved(BigInt(0)));

    render(<ProposalDetailPage />);

    expect(
      await screen.findByText(/Delegate your membership NFT on the Community page/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your voting power").parentElement?.querySelector(".font-mono")
        ?.textContent,
    ).toBe("0");
  });

  it("keeps proposal details visible when voting power read fails", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    nft.set("get_votes", rejected("votes boom"));

    render(<ProposalDetailPage />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Cast vote" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("votes boom")).not.toBeInTheDocument();
  });

  it("refreshes voting power when the connected address changes", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet("GWALLET1");
    nft.set(
      "get_votes",
      sequence(resolved(BigInt(1)), resolved(BigInt(4))),
    );

    const { rerender } = render(<ProposalDetailPage />);
    expect(await screen.findByText("1")).toBeInTheDocument();

    mockConnectedWallet("GWALLET2");
    rerender(<ProposalDetailPage />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(nft.get_votes.callCount()).toBe(2);
    expect(nft.get_votes.argsAt(0)).toEqual({ account: "GWALLET1" });
    expect(nft.get_votes.argsAt(1)).toEqual({ account: "GWALLET2" });
  });

  it("requests has_voted only when a wallet is connected", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    render(<ProposalDetailPage />);
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(walletGovernor.has_voted.callCount()).toBe(0);

    mockConnectedWallet("GWALLET");
    const { unmount } = render(<ProposalDetailPage />);
    unmount();
    render(<ProposalDetailPage />);
    await waitFor(() => expect(walletGovernor.has_voted.callCount()).toBeGreaterThan(0));
    expect(walletGovernor.has_voted.argsAt(0)?.account).toBe("GWALLET");
  });

  it.each([
    ["For", 1],
    ["Against", 0],
    ["Abstain", 2],
  ] as const)(
    "maps %s votes to vote_type %i with reason and voter",
    async (label, voteType) => {
      mocks.useParams.mockReturnValue({ id: VALID_ID });
      mockConnectedWallet("GVOTER");
      render(<ProposalDetailPage />);
      expect(await screen.findByRole("heading", { name: "Cast vote" })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Vote reason/i), {
        target: { value: "My reason" },
      });
      fireEvent.click(screen.getByRole("button", { name: label }));

      await waitFor(() => expect(walletGovernor.cast_vote.callCount()).toBe(1));
      const args = walletGovernor.cast_vote.lastArgs()!;
      expect(args.vote_type).toBe(voteType);
      expect(args.reason).toBe("My reason");
      expect(args.voter).toBe("GVOTER");
      expect(Buffer.from(args.proposal_id).toString("hex")).toBe(VALID_ID);
      expect(await screen.findByText("Vote confirmed!")).toBeInTheDocument();
    },
  );

  it("refreshes proposal state after a confirmed vote", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    readOnlyGovernor.set(
      "proposal_state",
      sequence(
        resolved(ProposalState.Active),
        resolved(ProposalState.Succeeded),
      ),
    );
    walletGovernor.set(
      "has_voted",
      sequence(resolved(false), resolved(true)),
    );

    render(<ProposalDetailPage />);
    expect(await screen.findByText("Active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "For" }));
    expect(await screen.findByText("Vote confirmed!")).toBeInTheDocument();
    await waitFor(() =>
      expect(readOnlyGovernor.proposal_state.callCount()).toBeGreaterThan(1),
    );
    await waitFor(() =>
      expect(walletGovernor.has_voted.callCount()).toBeGreaterThan(1),
    );
  });

  it("does not report success after wallet rejection", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    walletGovernor.setTransactionOptions({
      outcome: "failure",
      rejectOnSubmit: true,
      failureMessage: "User rejected the request",
    });

    render(<ProposalDetailPage />);
    expect(await screen.findByRole("heading", { name: "Cast vote" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "For" }));

    expect(
      (await screen.findAllByText(/rejected the wallet request/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Vote confirmed!")).not.toBeInTheDocument();
  });

  it("does not report success after a duplicate vote", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    walletGovernor.setTransactionOptions({
      outcome: "failure",
      rejectOnSubmit: true,
      failureMessage: "HostError: Error(Contract, #5016)",
    });

    render(<ProposalDetailPage />);
    expect(await screen.findByRole("heading", { name: "Cast vote" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Against" }));

    expect(
      (await screen.findAllByText("You have already voted on this proposal."))
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Vote confirmed!")).not.toBeInTheDocument();
  });
});
