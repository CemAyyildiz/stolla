import Link from "next/link";
import type { Community } from "@/lib/registry";

export function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      data-testid="community-card"
      data-community-slug={community.slug}
      className="block rounded-xl border border-slate-800 bg-[#151b2b] p-5 transition hover:border-indigo-800 hover:bg-[#1a2236]"
    >
      <h2 className="font-semibold text-slate-100">{community.name}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-slate-400">
        {community.description}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        {community.memberCount} members · {community.proposals.length} proposals
      </p>
    </Link>
  );
}
