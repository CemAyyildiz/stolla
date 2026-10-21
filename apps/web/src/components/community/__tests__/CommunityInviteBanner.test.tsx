/** Covers issue #407: the invite banner, dismissal, and connect-wallet CTA. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityInviteBanner } from "../CommunityInviteBanner";

const mocks = vi.hoisted(() => ({
  wallet: { address: null as string | null, connect: vi.fn(), isConnecting: false },
}));

vi.mock("@/context/WalletProvider", () => ({ useWallet: () => mocks.wallet }));

beforeEach(() => {
  mocks.wallet.address = null;
  mocks.wallet.isConnecting = false;
  mocks.wallet.connect.mockReset();
});

describe("CommunityInviteBanner", () => {
  it("shows the invited community's name and a connect prompt while disconnected", () => {
    render(<CommunityInviteBanner communityName="Alpha Builders" />);
    expect(screen.getByText("You've been invited to Alpha Builders")).toBeInTheDocument();
    expect(screen.getByText(/Connect your wallet to participate/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("falls back to generic invite copy when the community name isn't loaded yet", () => {
    render(<CommunityInviteBanner communityName={null} />);
    expect(screen.getByText("You've been invited")).toBeInTheDocument();
  });

  it("calls connect() when the CTA is activated, and never shows it once connected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommunityInviteBanner communityName="Alpha" />);

    await user.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(mocks.wallet.connect).toHaveBeenCalledTimes(1);

    mocks.wallet.address = "GCONNECTED";
    rerender(<CommunityInviteBanner communityName="Alpha" />);
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
    expect(screen.getByText(/Your wallet is connected/)).toBeInTheDocument();
  });

  it("is dismissible, and dismissing it never touches the URL (the invite link keeps working)", async () => {
    const user = userEvent.setup();
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(<CommunityInviteBanner communityName="Alpha" />);
    await user.click(screen.getByRole("button", { name: "Dismiss invite banner" }));

    expect(screen.queryByText(/You've been invited/)).not.toBeInTheDocument();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
    replaceStateSpy.mockRestore();
  });
});
