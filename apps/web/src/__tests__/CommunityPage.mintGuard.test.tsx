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

describe("CommunityPage mint submission guard", () => {
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

  it("invokes mint once for rapid pointer and keyboard activation", async () => {
    const sendGate = deferred<{ result: number }>();
    const mint = vi.fn().mockResolvedValue({
      signAndSend: () => sendGate.promise,
    });
    mocks.createNftClient.mockReturnValue({ mint });

    render(<CommunityPage />);

    const recipient = await screen.findByLabelText(/Recipient address/i);
    const tokenUri = screen.getByLabelText(/IPFS metadata URI/i);
    fireEvent.change(recipient, { target: { value: "GRECIPIENT" } });
    fireEvent.change(tokenUri, { target: { value: "ipfs://meta" } });

    const button = screen.getByRole("button", { name: "Mint NFT" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.click(button);

    await waitFor(() => expect(mint).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();

    await act(async () => {
      sendGate.resolve({ result: 7 });
    });

    expect(
      await screen.findByText("Minted token #7 successfully."),
    ).toBeInTheDocument();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("re-enables mint after rejection so the user can retry", async () => {
    const mint = vi
      .fn()
      .mockRejectedValueOnce(new Error("User rejected the request"))
      .mockResolvedValueOnce({
        signAndSend: async () => ({ result: 9 }),
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
    expect(await screen.findByText(/rejected the wallet request/i)).toBeInTheDocument();
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);
    expect(
      await screen.findByText("Minted token #9 successfully."),
    ).toBeInTheDocument();
    expect(mint).toHaveBeenCalledTimes(2);
  });
});
