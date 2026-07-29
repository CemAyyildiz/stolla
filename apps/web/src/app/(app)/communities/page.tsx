import { CommunitySearch } from "@/components/communities/CommunitySearch";
import { CommunityCard } from "@/components/communities/CommunityCard";
import { getCommunities } from "@/lib/registry";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const communities = getCommunities(q);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Communities</h1>
      <p className="mt-2 text-slate-400">
        Browse public communities, their proposal history, and governance
        activity. No wallet required.
      </p>

      <div className="mt-6">
        <CommunitySearch />
      </div>

      <div
        className="mt-6 grid gap-4 sm:grid-cols-2"
        data-testid="community-list"
        data-result-count={communities.length}
      >
        {communities.map((community) => (
          <CommunityCard key={community.slug} community={community} />
        ))}
      </div>

      {communities.length === 0 && (
        <p
          className="mt-6 text-sm text-slate-500"
          data-testid="community-empty-state"
        >
          No communities match &ldquo;{q}&rdquo;.
        </p>
      )}
    </div>
  );
}
