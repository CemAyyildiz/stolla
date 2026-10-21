import { describe, expect, it, vi } from "vitest";
import { loadActivityFeed, type ActivityFeedDependencies } from "../activityFeed";
import { ProposalState } from "@/lib/proposalState";
import type { Community } from "../types";

vi.mock("@/lib/proposal-events", () => ({ decodeProposalEvent: vi.fn(), fetchGovernorEvents: vi.fn() }));

function community(id: string): Community {
  return {
    record: {
      id, nftContract: `nft-${id}`, governorContract: `governor-${id}`,
      creator: "creator", communityOwner: "owner", createdAtLedger: 1,
      creationIndex: 1, metadataUri: "", metadataHash: "", metadataSchemaVersion: 1,
    },
    metadata: { schemaVersion: 1, name: id, description: "", externalLinks: [] },
    metadataError: null,
    governance: { votingDelay: null, votingPeriod: null, proposalThreshold: null, quorum: null, unavailableFields: [] },
  };
}

describe("loadActivityFeed", () => {
  it("includes active proposals and votes only from member communities", async () => {
    const first = community("first");
    const second = community("second");
    const balance = vi.fn(async (contract: string) => contract === "nft-first" ? 1n : 0n);
    const activity = vi.fn(async () => ({
      proposals: [
        { id: "aa", description: "Open", voteSnapshot: 10, voteEnd: 20, currentLedger: 12 },
        { id: "bb", description: "Closed", voteSnapshot: 1, voteEnd: 9, currentLedger: 12 },
      ],
      votes: [{ id: "aa", voteType: 1, ledger: 11, eventId: "event-1" }],
      incomplete: false,
    }));
    const dependencies = {
      registry: { list: vi.fn(async () => ({ communities: [first, second], nextCursor: null, malformedRecords: 0 })), get: vi.fn() },
      balance,
      activity,
      state: vi.fn(async (_contract: string, id: string) => id === "aa" ? ProposalState.Active : ProposalState.Succeeded),
    } as unknown as ActivityFeedDependencies;

    const feed = await loadActivityFeed("wallet", dependencies);
    expect(feed.memberCount).toBe(1);
    expect(balance).toHaveBeenCalledTimes(2);
    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("governor-first", "wallet");
    expect(feed.proposals.map((proposal) => proposal.id)).toEqual(["aa"]);
    expect(feed.votes.map((vote) => vote.eventId)).toEqual(["event-1"]);
    expect(feed.failures).toBe(0);
  });

  it("reports partial membership failures without exposing the failed community", async () => {
    const first = community("first");
    const second = community("second");
    const activity = vi.fn();
    const dependencies = {
      registry: { list: vi.fn(async () => ({ communities: [first, second], nextCursor: null, malformedRecords: 0 })), get: vi.fn() },
      balance: vi.fn(async (contract: string) => {
        if (contract === "nft-second") throw new Error("RPC unavailable");
        return 0n;
      }),
      activity,
      state: vi.fn(),
    } as unknown as ActivityFeedDependencies;

    const feed = await loadActivityFeed("wallet", dependencies);
    expect(feed.memberCount).toBe(0);
    expect(feed.failures).toBe(1);
    expect(feed.proposals).toEqual([]);
    expect(activity).not.toHaveBeenCalled();
  });
});
