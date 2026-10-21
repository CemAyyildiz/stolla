/**
 * Community-scoped view of typed proposal-discovery failures.
 *
 * Re-exports the canonical describer so community proposal history and the
 * global proposals page render identical, actionable copy.
 */
export {
  describeProposalDiscoveryError,
  type ProposalDiscoveryErrorCopy,
} from "@/lib/proposal-events/errors";
