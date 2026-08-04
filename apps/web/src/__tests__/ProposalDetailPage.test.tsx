import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  useWallet: vi.fn(),
  createGovernorClient: vi.fn(),
  useTransactionLifecycle: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: mocks.useParams }));
vi.mock("@/context/WalletProvider", () => ({ useWallet: mocks.useWallet }));
vi.mock("@/lib/contracts", () => ({
  createGovernorClient: mocks.createGovernorClient,
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

beforeEach(() => {
  vi.clearAllMocks();
  mockWallet();
  mockLifecycle();
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
    mocks.createGovernorClient.mockReturnValue({
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
    mocks.createGovernorClient.mockReturnValue({
      proposal_state: vi.fn().mockResolvedValue({ result: ProposalState.Active }),
    });

    render(<ProposalDetailPage />);

    expect(
      await screen.findByRole("heading", { name: "Cast vote" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Active")).toBeInTheDocument(),
    );
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
    mocks.createGovernorClient.mockReturnValue({
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
});
