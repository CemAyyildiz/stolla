export type {
  ProposalSummary,
  ProposalCreatedEventData,
  ProposalEventRpcMetadata,
} from "./types";

export { mapProposalCreatedEvent } from "./mapper";

export {
  dedupeProposalSummaries,
  proposalRowIdentity,
  stableEventIdentity,
} from "./dedupe";
export type { ProposalDiscoveryIdentityFields } from "./dedupe";
