import { Buffer } from "buffer";
import { rpc } from "@stellar/stellar-sdk";
import { createReadOnlyGovernorClient, createReadOnlyNftClient } from "@/lib/contracts";
import { type Community, type CommunityRegistry } from "@/lib/community/types";
import { communityRegistry } from "@/lib/community/registry";
import { decodeProposalEvent, fetchGovernorEvents } from "@/lib/proposal-events";
import { ProposalState } from "@/lib/proposalState";
import { config, requireGovernorStartLedger } from "@/lib/stellar";

export type FeedProposal = {
  community: Community;
  id: string;
  description: string;
  voteSnapshot: number;
  voteEnd: number;
  currentLedger: number | null;
};

export type FeedVote = {
  community: Community;
  id: string;
  voteType: number;
  ledger: number;
  eventId: string;
};

export type CommunityActivity = {
  proposals: Omit<FeedProposal, "community">[];
  votes: Omit<FeedVote, "community">[];
  incomplete: boolean;
};

export type ActivityFeed = {
  memberCount: number;
  proposals: FeedProposal[];
  votes: FeedVote[];
  failures: number;
  registryIncomplete: boolean;
};

export type ActivityFeedDependencies = {
  registry: CommunityRegistry;
  balance: (nftContract: string, address: string) => Promise<bigint | number>;
  activity: (governorContract: string, address: string) => Promise<CommunityActivity>;
  state: (governorContract: string, proposalId: string) => Promise<ProposalState>;
};

export const activityFeedDependencies: ActivityFeedDependencies = {
  registry: communityRegistry,
  async balance(nftContract, address) {
    const tx = await createReadOnlyNftClient(nftContract).balance({ account: address });
    return tx.result;
  },
  async state(governorContract, proposalId) {
    const tx = await createReadOnlyGovernorClient(governorContract).proposal_state({
      proposal_id: Buffer.from(proposalId, "hex"),
    });
    return tx.result;
  },
  async activity(governorContract, address) {
    const server = new rpc.Server(config.rpcUrl);
    const proposals: CommunityActivity["proposals"] = [];
    const votes: CommunityActivity["votes"] = [];
    const seenEvents = new Set<string>();
    let incomplete = false;
    try {
      for await (const page of fetchGovernorEvents({
        server,
        contractId: governorContract,
        startLedger: requireGovernorStartLedger(),
      })) {
        for (const event of page.events) {
          if (seenEvents.has(event.id)) continue;
          seenEvents.add(event.id);
          const decoded = decodeProposalEvent(event, { expectedContractId: governorContract });
          if (!decoded.ok) {
            if (decoded.reason !== "unknown-event-type" && decoded.reason !== "not-a-contract-event") incomplete = true;
            continue;
          }
          if (decoded.event.kind === "proposal_created") {
            proposals.push({
              id: decoded.event.proposalId,
              description: decoded.event.description,
              voteSnapshot: decoded.event.voteSnapshot,
              voteEnd: decoded.event.voteEnd,
              currentLedger: null,
            });
          } else if (decoded.event.kind === "vote_cast" && decoded.event.voter === address) {
            votes.push({
              id: decoded.event.proposalId,
              voteType: decoded.event.voteType,
              ledger: event.ledger,
              eventId: event.id,
            });
          }
        }
      }
    } catch (error) {
      if (proposals.length === 0 && votes.length === 0) throw error;
      incomplete = true;
    }
    const latest = await server.getLatestLedger().catch(() => null);
    const currentLedger = latest?.sequence ?? null;
    return {
      proposals: proposals.map((proposal) => ({ ...proposal, currentLedger })),
      votes,
      incomplete,
    };
  },
};

/** A failed balance never grants access to a community's activity. */
export async function loadActivityFeed(
  address: string,
  dependencies: ActivityFeedDependencies = activityFeedDependencies,
): Promise<ActivityFeed> {
  const result: ActivityFeed = {
    memberCount: 0,
    proposals: [],
    votes: [],
    failures: 0,
    registryIncomplete: false,
  };
  const communities: Community[] = [];
  const seen = new Set<string>();
  let cursor: number | null = null;
  try {
    do {
      const page = await dependencies.registry.list(cursor, 50);
      result.registryIncomplete ||= page.malformedRecords > 0;
      for (const community of page.communities) {
        if (seen.has(community.record.id)) continue;
        seen.add(community.record.id);
        communities.push(community);
      }
      if (page.nextCursor === cursor) throw new Error("Community registry cursor did not advance.");
      cursor = page.nextCursor;
    } while (cursor !== null);
  } catch {
    result.registryIncomplete = true;
  }

  const memberships = await Promise.allSettled(
    communities.map(async (community) => ({
      community,
      balance: await dependencies.balance(community.record.nftContract, address),
    })),
  );
  const members: Community[] = [];
  for (const membership of memberships) {
    if (membership.status === "rejected") {
      result.failures += 1;
    } else if (typeof membership.value.balance === "bigint"
      ? membership.value.balance > 0n
      : Number.isFinite(membership.value.balance) && membership.value.balance > 0) {
      members.push(membership.value.community);
    }
  }
  result.memberCount = members.length;

  const activity = await Promise.allSettled(members.map(async (community) => ({
    community,
    data: await dependencies.activity(community.record.governorContract, address),
  })));
  for (const entry of activity) {
    if (entry.status === "rejected") {
      result.failures += 1;
      continue;
    }
    const { community, data } = entry.value;
    if (data.incomplete) result.failures += 1;
    result.votes.push(...data.votes.map((vote) => ({ ...vote, community })));
    const states = await Promise.allSettled(data.proposals.map(async (proposal) => ({
      proposal,
      state: await dependencies.state(community.record.governorContract, proposal.id),
    })));
    for (const state of states) {
      if (state.status === "rejected") {
        result.failures += 1;
      } else if (state.value.state === ProposalState.Active) {
        result.proposals.push({ ...state.value.proposal, community });
      }
    }
  }
  result.proposals.sort((a, b) => a.voteEnd - b.voteEnd);
  result.votes.sort((a, b) => b.ledger - a.ledger);
  return result;
}
