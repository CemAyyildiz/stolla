/**
 * Re-exports the app's own deterministic community/proposal registry so the
 * Playwright flow always asserts against the exact data the app renders —
 * there is no separate, driftable copy of the fixtures.
 */
export {
  communityRegistry,
  getCommunities,
  getCommunityBySlug,
  getProposal,
  getProposals,
} from "../../src/lib/registry";
export type {
  Community,
  ProposalDetail,
  ProposalStatus,
  ProposalSummary,
} from "../../src/lib/registry";
