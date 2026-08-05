import { ProposalState } from "@/lib/bindings/community-governor/src";

export { ProposalState };

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export const PROPOSAL_STATE_ORDER: ProposalState[] = [
  ProposalState.Pending,
  ProposalState.Active,
  ProposalState.Defeated,
  ProposalState.Canceled,
  ProposalState.Succeeded,
  ProposalState.Queued,
  ProposalState.Expired,
  ProposalState.Executed,
];
