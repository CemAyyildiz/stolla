import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletContext } from "@/context/WalletProvider";
import { GuardianControls } from "@/components/community/GuardianControls";
import type { GuardianAdapter, GuardianState } from "@/lib/community/guardian";
import { config } from "@/lib/stellar";

vi.mock("@/context/WalletProvider", async () => {
  const React = await import("react");
  const WalletContext = React.createContext<unknown>(null);
  return {
    WalletContext,
    useOptionalWallet: () => React.useContext(WalletContext),
  };
});

const timelockId = "C" + "A".repeat(55);
const guardian = "G" + "B".repeat(55);
const outsider = "G" + "C".repeat(55);
const hash = "ab".repeat(32);

function renderControls(adapter: GuardianAdapter, address: string | null = guardian) {
  return render(
    <WalletContext.Provider value={{
      address,
      walletNetworkPassphrase: config.networkPassphrase,
      walletNetwork: "testnet",
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    }}>
      <GuardianControls timelockId={timelockId} adapter={adapter} />
    </WalletContext.Provider>,
  );
}

const available: GuardianState = {
  paused: false,
  guardian,
  canPause: true,
  canUnpause: true,
  canCancel: true,
};

describe("GuardianControls", () => {
  it("shows a prominent pause state to members and blocks non-guardian submissions", async () => {
    const submit = vi.fn();
    renderControls({ read: async () => ({ ...available, paused: true }), submit }, outsider);

    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent("Community paused");
    expect(screen.getByText(/This wallet is not authorized/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unpause community|Cancel queued action|Pause community/ })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("hides emergency controls when the Timelock does not expose the API", async () => {
    const submit = vi.fn();
    renderControls({ read: async () => null, submit });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("region", { name: "Community emergency controls" })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("recovers after wallet rejection and refreshes the visible pause state on success", async () => {
    const user = userEvent.setup();
    let paused = false;
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error("User rejected the request."))
      .mockImplementationOnce(async () => { paused = true; });
    renderControls({ read: async () => ({ ...available, paused }), submit });

    await screen.findByRole("button", { name: "Pause community" });
    await user.type(screen.getByRole("textbox", { name: /Reason hash/ }), hash);
    await user.click(screen.getByRole("button", { name: "Pause community" }));
    expect(await screen.findByText(/You rejected the wallet request/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause community" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Pause community" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Community paused");
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][3]).toEqual({ kind: "pause", durationLedgers: 120, reasonHash: hash });
  });

  it("offers cancellation and unpause only when those methods are available", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    renderControls({ read: async () => ({ ...available, paused: true }), submit });

    await screen.findByRole("button", { name: "Unpause community" });
    expect(screen.queryByRole("button", { name: "Pause community" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Reason hash/ }), hash);
    await user.type(screen.getByRole("textbox", { name: /Queued action ID/ }), hash);
    await user.click(screen.getByRole("button", { name: "Cancel queued action" }));
    expect(submit).toHaveBeenCalledWith(timelockId, guardian, expect.any(Function), {
      kind: "cancel", actionId: hash, reasonHash: hash,
    });
  });
});
