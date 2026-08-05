import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  createNftClient: vi.fn(),
  createReadOnlyNftClient: vi.fn(),
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
  loadCommunityData: vi.fn(),
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

describe("CommunityPage mint lifecycle", () => {
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

  it("shows simulating then approval then confirmation for mint", async () => {
    const signGate = deferred<void>();
    const sendGate = deferred<{ result: number; hash: string }>();
    const mint = vi.fn().mockResolvedValue({
      sign: () => signGate.promise,
      send: () => sendGate.promise,
    });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://meta" },
    });

    const button = screen.getByRole("button", { name: "Mint NFT" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(
      await screen.findByText("Waiting for wallet approval…"),
    ).toBeInTheDocument();
    expect(mint).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      signGate.resolve();
    });
    expect(
      await screen.findByText("Confirming on ledger…"),
    ).toBeInTheDocument();

    await act(async () => {
      sendGate.resolve({
        result: 7,
        hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      });
    });

    expect(
      await screen.findByText("Minted token #7 successfully."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Mint confirmed")).toBeInTheDocument();
  });

  it("re-enables mint after wallet rejection", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce({
        sign: async () => {
          throw new Error("User rejected the request");
        },
        send: vi.fn(),
      })
      .mockResolvedValueOnce({
        sign: async () => undefined,
        send: async () => ({ result: 9 }),
      });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);
    fireEvent.change(await screen.findByLabelText(/Recipient address/i), {
      target: { value: "GRECIPIENT" },
    });
    fireEvent.change(screen.getByLabelText(/IPFS metadata URI/i), {
      target: { value: "ipfs://meta" },
    });

    const button = screen.getByRole("button", { name: "Mint NFT" });
    fireEvent.click(button);
    expect(
      (await screen.findAllByText(/rejected the wallet request/i)).length,
    ).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);
    expect(
      await screen.findByText("Minted token #9 successfully."),
    ).toBeInTheDocument();
    expect(mint).toHaveBeenCalledTimes(2);
  });
});
