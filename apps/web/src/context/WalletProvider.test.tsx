import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { WalletProvider } from "./WalletProvider";

const walletKit = vi.hoisted(() => ({
  authModal: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(),
  on: vi.fn(() => vi.fn()),
}));

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: walletKit,
}));

vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  KitEventType: { STATE_UPDATED: "state_updated" },
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class FreighterModule {},
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/community",
}));

function renderWalletHeader() {
  return render(
    <WalletProvider>
      <Header />
    </WalletProvider>,
  );
}

describe("wallet connection feedback", () => {
  beforeEach(() => {
    walletKit.authModal.mockReset();
    walletKit.disconnect.mockReset();
    walletKit.init.mockReset();
    walletKit.on.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps deliberate modal dismissal silent", async () => {
    walletKit.authModal.mockRejectedValue({
      code: -1,
      message: "The user closed the modal.",
    });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    await vi.waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Connect Wallet" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows actionable feedback when Freighter is unavailable", async () => {
    walletKit.authModal.mockRejectedValue(
      new Error("Freighter is not connected"),
    );
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Freighter is unavailable. Install or unlock the wallet, then try again.",
    );
    expect(
      screen
        .getByRole("button", { name: "Connect Wallet" })
        .getAttribute("aria-describedby"),
    ).toBe(alert.id);
  });

  it("distinguishes a rejected connection request", async () => {
    walletKit.authModal.mockRejectedValue({
      code: -4,
      message: "The user rejected this request.",
    });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Connection request declined. Approve the request in your wallet to connect.",
    );
  });

  it("hides provider details for an unexpected failure", async () => {
    walletKit.authModal.mockRejectedValue(
      new Error("RPC failed for account SECRET_ACCOUNT"),
    );
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    const alertText = (await screen.findByRole("alert")).textContent;
    expect(alertText).toBe(
      "We couldn't connect to your wallet. Please try again.",
    );
    expect(alertText).not.toContain("SECRET_ACCOUNT");
  });

  it("clears a stale error during retry and after a successful connection", async () => {
    let finishRetry: (value: { address: string }) => void = () => undefined;
    const pendingRetry = new Promise<{ address: string }>((resolve) => {
      finishRetry = resolve;
    });
    walletKit.authModal
      .mockRejectedValueOnce(new Error("Unexpected provider failure"))
      .mockReturnValueOnce(pendingRetry);
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(
      screen
        .getByRole("button", { name: "Connecting..." })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();

    finishRetry({ address: "GCONNECTED" });

    expect(
      await screen.findByRole("button", { name: "Disconnect" }),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves disconnect behavior after a successful connection", async () => {
    walletKit.authModal.mockResolvedValue({ address: "GCONNECTED" });
    renderWalletHeader();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );

    expect(walletKit.disconnect).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Connect Wallet" }),
    ).not.toBeNull();
  });
});
