import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
  loadCommunityData: vi.fn(),
  runCommunityRefresh: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: mocks.useWallet,
}));

vi.mock("@/lib/contracts", () => ({
  createNftClient: mocks.createNftClient,
  createReadOnlyNftClient: mocks.createReadOnlyNftClient,
}));

vi.mock("@/lib/stellar", () => ({
  contractIds: { nft: "CNFT", governor: "CGOV" },
}));

vi.mock("@/app/(app)/community/community-data.mjs", () => ({
  loadCommunityData: mocks.loadCommunityData,
  runCommunityRefresh: mocks.runCommunityRefresh,
}));

import CommunityPage from "@/app/(app)/community/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("CommunityPage delegation lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWallet.mockReturnValue({
      address: "GWALLET",
      signTransaction: vi.fn(),
      isConnecting: false,
    });
    mocks.runCommunityRefresh.mockImplementation(
      async (
        _load: unknown,
        callbacks: {
          onStart: () => void;
          onSuccess: (data: {
            name: string;
            symbol: string;
            balance: number;
            votes: string;
          }) => void;
          onError: (message: string) => void;
        },
      ) => {
        callbacks.onStart();
        callbacks.onSuccess({
          name: "Stolla",
          symbol: "STL",
          balance: 1,
          votes: "0",
        });
        return true;
      },
    );
  });

  it("walks delegation through approval, submission, confirmation, then refreshes votes", async () => {
    const signGate = deferred<void>();
    const sendGate = deferred<void>();
    const sign = vi.fn().mockReturnValue(signGate.promise);
    const send = vi.fn().mockReturnValue(sendGate.promise);

    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({ sign, send }),
    });

    render(<CommunityPage />);

    const button = await screen.findByRole("button", {
      name: "Delegate to self",
    });
    fireEvent.click(button);

    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();

    await act(async () => {
      signGate.resolve();
    });
    expect(
      await screen.findByText("Confirming on ledger…"),
    ).toBeInTheDocument();

    const refreshCallsBeforeConfirm = mocks.runCommunityRefresh.mock.calls.length;

    await act(async () => {
      sendGate.resolve();
    });

    expect(await screen.findByText("Delegate confirmed")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.runCommunityRefresh.mock.calls.length).toBeGreaterThan(
        refreshCallsBeforeConfirm,
      );
    });
  });

  it("shows a distinct still-pending outcome and blocks double submit", async () => {
    const signGate = deferred<void>();
    mocks.createNftClient.mockReturnValue({
      delegate: vi.fn().mockResolvedValue({
        sign: () => signGate.promise,
        send: vi.fn(),
      }),
    });

    render(<CommunityPage />);
    const button = await screen.findByRole("button", {
      name: "Delegate to self",
    });
    fireEvent.click(button);
    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();

    fireEvent.click(button);
    expect(mocks.createNftClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      signGate.reject(new Error("Transaction timed out while still pending"));
    });

    expect(await screen.findByText("Still pending")).toBeInTheDocument();
    expect(
      screen.getAllByText(/still pending on the network/i).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
