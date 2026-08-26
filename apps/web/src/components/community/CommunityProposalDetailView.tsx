"use client";

import { getCommunityById } from "@/lib/communities/registry";
import type { CommunityRecord } from "@/lib/communities/types";
import {
  useCommunityProposal,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { AsyncState } from "@/components/ui/AsyncState";
import { ErrorState } from "@/components/ui/ErrorState";

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export type CommunityProposalDetailViewProps = {
  communityId: string;
  proposalId: string;
  registry?: CommunityRecord[];
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalDetailView({
  communityId,
  proposalId,
  registry,
  getReader,
}: CommunityProposalDetailViewProps) {
  const community = getCommunityById(communityId, registry);

  if (!community) {
    return <CommunityNotFound communityId={communityId} />;
  }

  return (
    <CommunityProposalDetailPanel
      community={community}
      proposalId={proposalId}
      getReader={getReader}
    />
  );
}

function CommunityProposalDetailPanel({
  community,
  proposalId,
  getReader,
}: {
  community: CommunityRecord;
  proposalId: string;
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposal(
    community.governorContractId,
    proposalId,
    getReader,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.id}
        communityName={community.name}
        proposalId={proposalId}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        Proposal #{proposalId}
      </h1>

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposal…
        </AsyncState>
      )}
      {resolution.status === "error" && (
        <ErrorState className="mt-6" title="Proposal unavailable">
          {resolution.error}
        </ErrorState>
      )}
      {resolution.status === "ready" && (
        <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">State</dt>
            <dd className="font-medium text-slate-100">
              {stateLabels[resolution.state]}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Community</dt>
            <dd className="font-medium text-slate-100">{community.name}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
