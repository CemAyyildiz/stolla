import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityPage from "./page";

const mocks = vi.hoisted(() => ({
  wallet: { address: null as string | null, connect: vi.fn(), isConnecting: false },
  load: vi.fn(),
}));

vi.mock("@/context/WalletProvider", () => ({ useWallet: () => mocks.wallet }));
vi.mock("@/lib/community/activityFeed", () => ({ loadActivityFeed: mocks.load }));

beforeEach(() => {
  mocks.wallet.address = null;
  mocks.load.mockReset();
});

describe("ActivityPage", () => {
  it("prompts a disconnected wallet without loading a feed", () => {
    render(<ActivityPage />);
    expect(screen.getByText(/Connect your wallet to see activity/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("links a member's active proposal and vote to canonical community URLs", async () => {
    mocks.wallet.address = "wallet";
    const community = {
      record: { id: "community-one" },
      metadata: { name: "One" },
    };
    mocks.load.mockResolvedValue({
      memberCount: 1,
      proposals: [{ community, id: "aa", description: "Open proposal", voteSnapshot: 10, voteEnd: 20, currentLedger: 12 }],
      votes: [{ community, id: "aa", voteType: 1, ledger: 11, eventId: "vote-1" }],
      failures: 0,
      registryIncomplete: false,
    });

    render(<ActivityPage />);
    expect(await screen.findByText("One · Active")).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/proposals/"));
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/community/community-one/proposals/aa",
      "/community/community-one/proposals/aa",
    ]);
  });
});
