/**
 * Deterministic public community/proposal registry.
 *
 * Until a live on-chain registry contract is deployed, the public
 * `/communities` routes read from this static, fully deterministic data
 * source. It doubles as the fixture set for the Playwright multi-community
 * browsing flow (see apps/web/e2e/multi-community-browsing.spec.ts) so the
 * app and its tests can never drift apart.
 */

export type ProposalStatus = "active" | "passed" | "rejected" | "executed";

export interface ProposalSummary {
  id: string;
  title: string;
  status: ProposalStatus;
  createdAt: string;
}

export interface ProposalDetail extends ProposalSummary {
  description: string;
  proposer: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}

export interface Community {
  slug: string;
  name: string;
  description: string;
  governorContractId: string;
  nftContractId: string;
  memberCount: number;
  proposals: ProposalDetail[];
}

// NOTE: both communities intentionally reuse proposal id "1" to prove that
// proposal context stays scoped to its parent community/Governor and never
// leaks across a community switch.
export const communityRegistry: Community[] = [
  {
    slug: "stellar-builders",
    name: "Stellar Builders Guild",
    description:
      "Grants and tooling proposals for Stellar/Soroban ecosystem builders.",
    governorContractId: "CGOVSTELLARBUILDERS0000000000000000000000000000",
    nftContractId: "CNFTSTELLARBUILDERS00000000000000000000000000000",
    memberCount: 482,
    proposals: [
      {
        id: "1",
        title: "Fund a Soroban CLI onboarding workshop series",
        status: "active",
        createdAt: "2026-06-02",
        description:
          "Allocate treasury funds to run four beginner-friendly Soroban CLI workshops.",
        proposer: "GA...BUILD1",
        forVotes: 12840,
        againstVotes: 960,
        abstainVotes: 210,
      },
      {
        id: "2",
        title: "Adopt a shared contract-binding style guide",
        status: "passed",
        createdAt: "2026-04-18",
        description:
          "Standardize generated TypeScript bindings across member projects.",
        proposer: "GA...BUILD2",
        forVotes: 15120,
        againstVotes: 340,
        abstainVotes: 90,
      },
    ],
  },
  {
    slug: "gardeners-guild",
    name: "Gardeners Guild",
    description:
      "Community garden cooperative coordinating shared plots and tool libraries.",
    governorContractId: "CGOVGARDENERSGUILD000000000000000000000000000000",
    nftContractId: "CNFTGARDENERSGUILD0000000000000000000000000000000",
    memberCount: 137,
    proposals: [
      {
        id: "1",
        title: "Purchase a shared greenhouse for winter seedlings",
        status: "active",
        createdAt: "2026-06-10",
        description:
          "Buy and install a 20x10 greenhouse at the north plot for winter propagation.",
        proposer: "GA...GARDEN1",
        forVotes: 640,
        againstVotes: 55,
        abstainVotes: 12,
      },
      {
        id: "2",
        title: "Retire the unused east-plot compost bins",
        status: "rejected",
        createdAt: "2026-03-01",
        description:
          "Remove the east-plot compost bins that have been unused since last season.",
        proposer: "GA...GARDEN2",
        forVotes: 210,
        againstVotes: 480,
        abstainVotes: 8,
      },
    ],
  },
];

export function getCommunities(query?: string): Community[] {
  const q = query?.trim().toLowerCase();
  if (!q) return communityRegistry;
  return communityRegistry.filter((community) =>
    community.name.toLowerCase().includes(q),
  );
}

export function getCommunityBySlug(slug: string): Community | undefined {
  return communityRegistry.find((community) => community.slug === slug);
}

export function getProposals(slug: string): ProposalSummary[] | undefined {
  return getCommunityBySlug(slug)?.proposals;
}

export function getProposal(
  slug: string,
  proposalId: string,
): ProposalDetail | undefined {
  return getCommunityBySlug(slug)?.proposals.find(
    (proposal) => proposal.id === proposalId,
  );
}
