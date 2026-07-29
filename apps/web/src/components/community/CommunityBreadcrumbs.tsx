import Link from "next/link";

export type CommunityBreadcrumbsProps = {
  communityId: string;
  communityName: string;
  proposalId?: string;
};

export function CommunityBreadcrumbs({
  communityId,
  communityName,
  proposalId,
}: CommunityBreadcrumbsProps) {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Communities", href: "/community" },
    { label: communityName, href: `/community/${communityId}` },
  ];

  if (proposalId) {
    trail.push({
      label: `Proposal #${proposalId}`,
      href: `/community/${communityId}/proposals/${proposalId}`,
    });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-400">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isLast ? (
                <span aria-current="page" className="font-medium text-slate-100">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-slate-100 hover:underline">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
