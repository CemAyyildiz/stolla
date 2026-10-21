import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityOwnershipSettings } from "../CommunityOwnershipSettings";
import { atlasCommunity } from "@/test/fixtures/communities";
import { activeNetwork } from "@/lib/stellar";

const mocks = vi.hoisted(() => ({
  wallet: vi.fn(),
  readOwner: vi.fn(),
  simulate: vi.fn(),
  begin: vi.fn(),
  accept: vi.fn(),
  syncRegistry: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({ useWallet: mocks.wallet }));
vi.mock("@/lib/community/ownership", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community/ownership")>("@/lib/community/ownership");
  return {
    ...actual,
    communityOwnership: {
      readOwner: mocks.readOwner,
      simulate: mocks.simulate,
      begin: mocks.begin,
      accept: mocks.accept,
      syncRegistry: mocks.syncRegistry,
    },
  };
});

const owner = "G" + "A".repeat(55);
const recipient = "G" + "B".repeat(55);
const signTransaction = vi.fn();

function setWallet(address: string) {
  mocks.wallet.mockReturnValue({ address, signTransaction, walletNetworkPassphrase: activeNetwork.networkPassphrase });
}

describe("CommunityOwnershipSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readOwner.mockResolvedValue(owner);
    mocks.accept.mockResolvedValue(undefined);
    mocks.syncRegistry.mockResolvedValue(undefined);
    setWallet(owner);
  });

  it("does not offer transfer controls to a wallet that is not the NFT owner", async () => {
    setWallet(recipient);
    render(<CommunityOwnershipSettings record={atlasCommunity.record} refresh={vi.fn()} />);
    await screen.findByText(`Current NFT owner: ${owner}`);
    expect(screen.queryByRole("button", { name: "Simulate transfer" })).not.toBeInTheDocument();
  });

  it("rejects a secret seed before enabling simulation", async () => {
    const user = userEvent.setup();
    render(<CommunityOwnershipSettings record={atlasCommunity.record} refresh={vi.fn()} />);
    const input = await screen.findByLabelText("New owner G address");
    await user.type(input, "S" + "A".repeat(55));
    expect(screen.getByText(/valid Stellar G address/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate transfer" })).toBeDisabled();
    expect(mocks.simulate).not.toHaveBeenCalled();
  });

  it("refreshes ownership and registry after the recipient accepts", async () => {
    const user = userEvent.setup();
    setWallet(recipient);
    mocks.readOwner.mockResolvedValueOnce(owner).mockResolvedValue(recipient);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<CommunityOwnershipSettings record={atlasCommunity.record} refresh={refresh} />);
    const accept = await screen.findByRole("button", { name: "Accept pending NFT ownership" });
    await user.click(accept);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mocks.accept).toHaveBeenCalledWith(atlasCommunity.record.nftContract, recipient, signTransaction);
    expect(mocks.syncRegistry).toHaveBeenCalledWith(atlasCommunity.record.id, recipient, signTransaction);
    await screen.findByText(`Current NFT owner: ${recipient}`);

    setWallet(owner);
    view.rerender(<CommunityOwnershipSettings record={atlasCommunity.record} refresh={refresh} />);
    expect(screen.queryByRole("button", { name: "Simulate transfer" })).not.toBeInTheDocument();
  });
});
