/**
 * Canonical user-facing copy for typed proposal-discovery failures.
 *
 * `types.ts` classifies raw failures into `ProposalDiscoveryErrorKind`;
 * this module attaches stable, actionable sentences to each kind so every
 * surface (global proposals, community-scoped history) renders the same
 * operator guidance.
 */
import {
  mapProposalDiscoveryError,
  type ProposalDiscoveryError,
  type ProposalDiscoveryErrorKind,
} from "./types";

export { mapProposalDiscoveryError };
export type { ProposalDiscoveryError, ProposalDiscoveryErrorKind };

/** Machine-readable code alias kept for call-site API stability. */
export type ProposalDiscoveryErrorCode = ProposalDiscoveryErrorKind;

export type ProposalDiscoveryErrorCopy = {
  /** Short heading for alert chrome. */
  title: string;
  /** Full operator-facing sentence. Falls back to the concrete raw message. */
  message: string;
  /** Compact label for dense rows. */
  shortLabel: string;
};

export type ProposalDiscoveryErrorMapping = Record<
  ProposalDiscoveryErrorCode,
  ProposalDiscoveryErrorCopy
>;

export const PROPOSAL_DISCOVERY_ERROR_COPY: ProposalDiscoveryErrorMapping = {
  "config-missing": {
    title: "Proposal discovery is not configured",
    message:
      "Set NEXT_PUBLIC_GOVERNOR_START_LEDGER to the ledger where the Governor was deployed, then reload.",
    shortLabel: "Not configured",
  },
  "retention-clamp": {
    title: "Start ledger is outside the RPC retention window",
    message:
      "The scan started before the oldest ledger the RPC still retains. Adjust NEXT_PUBLIC_GOVERNOR_START_LEDGER or use a provider with wider history.",
    shortLabel: "Outside retention window",
  },
  "rpc-network": {
    title: "Proposal history is temporarily unavailable",
    message:
      "The RPC endpoint could not be reached. Retry once the endpoint is healthy.",
    shortLabel: "RPC unavailable",
  },
  "decode-partial": {
    title: "Some proposal events could not be decoded",
    message:
      "Partial history is shown. The remaining events can be retrieved with an indexer.",
    shortLabel: "Partial history",
  },
};

/** Map a raw discovery failure onto its kind without rendering anything. */
export function classifyProposalDiscoveryError(
  error: unknown,
): ProposalDiscoveryError {
  return mapProposalDiscoveryError(error);
}

/** Attach stable, actionable copy to a raw discovery failure. */
export function describeProposalDiscoveryError(
  error: unknown,
): ProposalDiscoveryErrorCopy {
  const mapped = mapProposalDiscoveryError(error);
  const copy = PROPOSAL_DISCOVERY_ERROR_COPY[mapped.kind];
  return {
    title: copy.title,
    message: mapped.message || copy.message,
    shortLabel: copy.shortLabel,
  };
}
