import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCommunityBySlug } from "@/lib/registry";

const statusStyles: Record<string, string> = {
  active: "bg-indigo-950 text-indigo-300",
  passed: "bg-emerald-950 text-emerald-300",
  rejected: "bg-rose-950 text-rose-300",
  executed: "bg-slate-800 text-slate-300",
};

export default async function CommunityProposalsPage({
  params,
}: {
  params: Promise<{ communityId: string }>;
}) {
  const { communityId } = await params;
  const community = getCommunityBySlug(communityId);

  if (!community) {
    notFound();
  }

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-10"
      data-testid="community-proposals"
      data-community-slug={community.slug}
    >
      <Breadcrumbs
        items={[
          { label: "Communities", href: "/communities" },
          { label: community.name, href: `/communities/${community.slug}` },
          { label: "Proposals" },
        ]}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {community.name} proposals
      </h1>

      <ul className="mt-6 space-y-3" data-testid="proposal-list">
        {community.proposals.map((proposal) => (
          <li key={proposal.id}>
            <Link
              href={`/communities/${community.slug}/proposals/${proposal.id}`}
              data-testid="proposal-list-item"
              data-proposal-id={proposal.id}
              className="block rounded-xl border border-slate-800 bg-[#151b2b] p-4 hover:border-indigo-800"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-100">
                  {proposal.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${statusStyles[proposal.status]}`}
                >
                  {proposal.status}
                </span>
              </div>
              <span className="mt-1 block text-xs text-slate-500">
                {proposal.createdAt}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {community.proposals.length === 0 && (
        <p
          className="mt-6 text-sm text-slate-500"
          data-testid="proposal-empty-state"
        >
          No proposals yet for this community.
        </p>
      )}
    </div>
  );
}
