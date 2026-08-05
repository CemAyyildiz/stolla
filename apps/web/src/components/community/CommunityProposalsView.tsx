"use client";

import Link from "next/link";
import { getCommunityById } from "@/lib/communities/registry";
import type { CommunityRecord } from "@/lib/communities/types";
import { getStoredProposalIdsFor } from "@/lib/contracts";
import {
  useCommunityProposals,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";

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

export type CommunityProposalsViewProps = {
  communityId: string;
  registry?: CommunityRecord[];
  proposalIds?: string[];
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalsView({
  communityId,
  registry,
  proposalIds,
  getReader,
}: CommunityProposalsViewProps) {
  const community = getCommunityById(communityId, registry);

  if (!community) {
    return <CommunityNotFound communityId={communityId} />;
  }

  return (
    <CommunityProposalsPanel
      community={community}
      proposalIds={proposalIds ?? getStoredProposalIdsFor(community.governorContractId)}
      getReader={getReader}
    />
  );
}

function CommunityProposalsPanel({
  community,
  proposalIds,
  getReader,
}: {
  community: CommunityRecord;
  proposalIds: string[];
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposals(
    community.governorContractId,
    proposalIds,
    getReader,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs communityId={community.id} communityName={community.name} />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {community.name} proposals
      </h1>

      {resolution.status === "loading" && (
        <p className="mt-6 text-sm text-slate-500">Loading proposals…</p>
      )}

      {resolution.status === "ready" && proposalIds.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No proposals yet.</p>
      )}

      {resolution.status === "ready" && proposalIds.length > 0 && (
        <ul className="mt-6 space-y-2">
          {resolution.entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/community/${community.id}/proposals/${entry.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80"
              >
                <span className="truncate font-mono">#{entry.id}</span>
                <span
                  className={`ml-3 ${entry.status === "error" ? "text-rose-400" : "text-slate-500"}`}
                >
                  {entry.status === "ready" ? stateLabels[entry.state] : "Unavailable"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
