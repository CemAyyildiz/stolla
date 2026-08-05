import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCommunityBySlug, getProposal } from "@/lib/registry";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ communityId: string; proposalId: string }>;
}) {
  const { communityId, proposalId } = await params;
  const community = getCommunityBySlug(communityId);
  const proposal = community
    ? getProposal(communityId, proposalId)
    : undefined;

  if (!community || !proposal) {
    notFound();
  }

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-10"
      data-testid="proposal-detail"
      data-community-slug={community.slug}
      data-proposal-id={proposal.id}
    >
      <Breadcrumbs
        items={[
          { label: "Communities", href: "/communities" },
          { label: community.name, href: `/communities/${community.slug}` },
          {
            label: "Proposals",
            href: `/communities/${community.slug}/proposals`,
          },
          { label: proposal.title },
        ]}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {proposal.title}
      </h1>
      <p className="mt-2 text-slate-400">{proposal.description}</p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium text-slate-100" data-testid="proposal-status">
            {proposal.status}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Proposer</dt>
          <dd className="font-mono text-xs">{proposal.proposer}</dd>
        </div>
        <div>
          <dt className="text-slate-500">For</dt>
          <dd>{proposal.forVotes.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Against</dt>
          <dd>{proposal.againstVotes.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Abstain</dt>
          <dd>{proposal.abstainVotes.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Governor</dt>
          <dd className="break-all font-mono text-xs">
            {community.governorContractId}
          </dd>
        </div>
      </dl>
    </div>
  );
}
