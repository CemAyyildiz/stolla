import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useWallet: vi.fn(),
  createGovernorClient: vi.fn(),
  createReadOnlyGovernorClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  fetchVoteTotals: vi.fn(),
  useTransactionLifecycle: vi.fn(),
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
vi.mock("@/hooks/useTransactionLifecycle", () => ({
  useTransactionLifecycle: mocks.useTransactionLifecycle,
}));
vi.mock("@/lib/stellar", () => ({
  contractIds: { nft: "CNFT", governor: "CGOV" },
  config: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://rpc",
    horizonUrl: "https://horizon",
    friendbotUrl: null,
  },
  stellarConfig: { testnet: {}, mainnet: {} },
}));

import ProposalDetailPage from "@/app/(app)/proposals/[id]/page";

const VALID_ID = "ab".repeat(32);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function mockWallet() {
  mocks.useWallet.mockReturnValue({
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    isConnecting: false,
  });
}

function mockLifecycle() {
  mocks.useTransactionLifecycle.mockReturnValue({
    state: {
      stage: "idle",
      voteType: null,
      reason: "",
      error: null,
      isTerminal: false,
    },
    execute: vi.fn(),
    reset: vi.fn(),
  });
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

function mockReadOnly(overrides: Record<string, unknown> = {}) {
  mocks.createReadOnlyGovernorClient.mockReturnValue({
    proposal_proposer: vi.fn().mockResolvedValue({ result: "GPROPOSER" }),
    proposal_deadline: vi.fn().mockResolvedValue({ result: 2_000_000 }),
    ...overrides,
  });
}

function mockGovernor(overrides: Record<string, unknown> = {}) {
  mocks.createGovernorClient.mockReturnValue({
    proposal_state: vi.fn().mockResolvedValue({ result: ProposalState.Active }),
    has_voted: vi.fn().mockResolvedValue({ result: false }),
    proposal_snapshot: vi.fn().mockResolvedValue({ result: 1_500_000 }),
    quorum: vi.fn().mockResolvedValue({ result: BigInt(100) }),
    ...overrides,
  });
}

function mockNft(overrides: Record<string, unknown> = {}) {
  mocks.createReadOnlyNftClient.mockReturnValue({
    get_votes: vi.fn().mockResolvedValue({ result: BigInt(3) }),
    ...overrides,
  });
}

function mockConnectedWallet(address = "GWALLET") {
  mocks.useWallet.mockReturnValue({
    address,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    isConnecting: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWallet();
  mockLifecycle();
  mockVoteTotals();
  mockReadOnly();
  mockGovernor();
  mockNft();
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
    mockGovernor({
      proposal_state: vi.fn().mockRejectedValue(new Error("Contract error")),
    });

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
    const snapshot = vi.fn().mockResolvedValue({ result: 1_500_000 });
    const deadline = vi.fn().mockResolvedValue({ result: 2_000_000 });
    mockGovernor({ proposal_snapshot: snapshot });
    mockReadOnly({ proposal_deadline: deadline });

    render(<ProposalDetailPage />);

    expect(await screen.findByText("1500000")).toBeInTheDocument();
    expect(screen.getByText("2000000")).toBeInTheDocument();
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(deadline).toHaveBeenCalledTimes(1);
    const snapshotArg = snapshot.mock.calls[0][0];
    const deadlineArg = deadline.mock.calls[0][0];
    // Vitest/jsdom can expose Buffer instances that fail Buffer.isBuffer across realms.
    expect(snapshotArg.proposal_id).toBeInstanceOf(Uint8Array);
    expect(deadlineArg.proposal_id).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(snapshotArg.proposal_id).toString("hex")).toBe(VALID_ID);
    expect(Buffer.from(deadlineArg.proposal_id).toString("hex")).toBe(VALID_ID);
  });

  it("keeps proposal state visible when deadline read fails", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockReadOnly({
      proposal_deadline: vi.fn().mockRejectedValue(new Error("deadline boom")),
    });

    render(<ProposalDetailPage />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("1500000")).toBeInTheDocument();
  });

  it("ignores a stale response after navigating to another proposal", async () => {
    const firstId = "ab".repeat(32);
    const secondId = "cd".repeat(32);
    let currentId = firstId;
    const firstResponse = deferred<{ result: ProposalState }>();
    const secondResponse = deferred<{ result: ProposalState }>();
    const proposalState = vi
      .fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);

    mocks.useParams.mockImplementation(() => ({ id: currentId }));
    mockGovernor({
      proposal_state: proposalState,
    });

    const { rerender } = render(<ProposalDetailPage />);
    currentId = secondId;
    rerender(<ProposalDetailPage />);

    await act(async () => {
      secondResponse.resolve({ result: ProposalState.Active });
    });
    expect(await screen.findByText("Active")).toBeInTheDocument();

    await act(async () => {
      firstResponse.resolve({ result: ProposalState.Pending });
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
    const pending = deferred<{ result: bigint }>();
    mockNft({ get_votes: vi.fn().mockReturnValue(pending.promise) });

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
      pending.resolve({ result: BigInt(7) });
    });
    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("shows exact positive voting power without precision loss", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    const power = BigInt("9007199254740993");
    mockNft({
      get_votes: vi.fn().mockResolvedValue({ result: power }),
    });

    render(<ProposalDetailPage />);

    expect(await screen.findByText(power.toString())).toBeInTheDocument();
  });

  it("guides users when voting power is zero", async () => {
    mocks.useParams.mockReturnValue({ id: VALID_ID });
    mockConnectedWallet();
    mockNft({
      get_votes: vi.fn().mockResolvedValue({ result: BigInt(0) }),
    });

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
    mockNft({
      get_votes: vi.fn().mockRejectedValue(new Error("votes boom")),
    });

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
    const getVotes = vi
      .fn()
      .mockResolvedValueOnce({ result: BigInt(1) })
      .mockResolvedValueOnce({ result: BigInt(4) });
    mockNft({ get_votes: getVotes });

    const { rerender } = render(<ProposalDetailPage />);
    expect(await screen.findByText("1")).toBeInTheDocument();

    mockConnectedWallet("GWALLET2");
    rerender(<ProposalDetailPage />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(getVotes).toHaveBeenCalledTimes(2);
    expect(getVotes.mock.calls[0][0]).toEqual({ account: "GWALLET1" });
    expect(getVotes.mock.calls[1][0]).toEqual({ account: "GWALLET2" });
  });
});
