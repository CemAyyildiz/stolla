import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCommunityBySlug } from "@/lib/registry";

export default async function CommunityDetailPage({
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
      data-testid="community-detail"
      data-community-slug={community.slug}
    >
      <Breadcrumbs
        items={[
          { label: "Communities", href: "/communities" },
          { label: community.name },
        ]}
      />

      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        {community.name}
      </h1>
      <p className="mt-2 text-slate-400">{community.description}</p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Members</dt>
          <dd className="font-medium text-slate-100">
            {community.memberCount}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Governor contract</dt>
          <dd className="break-all font-mono text-xs">
            {community.governorContractId}
          </dd>
        </div>
      </dl>

      <Link
        href={`/communities/${community.slug}/proposals`}
        data-testid="view-proposals-link"
        className="mt-6 inline-block rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
      >
        View proposal history
      </Link>
    </div>
  );
}
