export type SkeletonVariant = "pulse" | "shimmer";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * `shimmer` marks an active load with a sweeping highlight; `pulse` is the
   * calmer default used by secondary surfaces. Both are gated behind
   * `motion-safe:` so reduced-motion users keep a static - still visible -
   * placeholder.
   */
  variant?: SkeletonVariant;
};

/**
 * Shared skeleton building block.
 *
 * The fill is lighter than the card surface on purpose: a placeholder must
 * never be mistaken for a disabled form field, which is always darker than
 * the surface it sits on.
 */
export function Skeleton({
  className,
  variant = "pulse",
  ...props
}: SkeletonProps) {
  return (
    <div
      data-testid="skeleton"
      data-variant={variant}
      className={`skeleton-fill rounded-md ${
        variant === "shimmer"
          ? "motion-safe:animate-shimmer"
          : "motion-safe:animate-pulse"
      } ${className ?? ""}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export type SkeletonStatProps = {
  /** Stays visible so a loading row never collapses into an unlabeled block. */
  label: string;
  /** Tailwind width class for the placeholder value. */
  valueWidth?: string;
  variant?: SkeletonVariant;
  className?: string;
};

/**
 * Labeled statistic placeholder for `<dl>` rows.
 *
 * The label is real text, so the loaded layout does not jump: "Name",
 * "Symbol", "Your balance" stay exactly where the reader expects them.
 */
export function SkeletonStat({
  label,
  valueWidth = "w-24",
  variant = "shimmer",
  className,
}: SkeletonStatProps) {
  return (
    <div className={className}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5">
        <Skeleton variant={variant} className={`h-5 ${valueWidth}`} />
      </dd>
    </div>
  );
}

export type SkeletonCommunityRowProps = {
  variant?: SkeletonVariant;
  className?: string;
};

/**
 * Community list row chrome.
 *
 * Mirrors the CommunityCard layout (avatar, name + id, description, four
 * governance stats, action) so the grid does not jump when the registry
 * resolves. Stat labels stay visible for the same reason.
 */
export function SkeletonCommunityRow({
  variant = "shimmer",
  className,
}: SkeletonCommunityRowProps) {
  return (
    <article
      aria-hidden="true"
      className={`flex h-full min-w-0 flex-col rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton variant={variant} className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Skeleton variant={variant} className="h-5 w-2/3" />
          <Skeleton variant={variant} className="mt-2 h-3 w-1/2" />
        </div>
      </div>
      <Skeleton variant={variant} className="mt-4 h-4 w-full" />
      <Skeleton variant={variant} className="mt-2 h-4 w-5/6" />
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-sm">
        <SkeletonStat
          label="Proposal threshold"
          valueWidth="w-16"
          variant={variant}
        />
        <SkeletonStat label="Quorum" valueWidth="w-16" variant={variant} />
        <SkeletonStat label="Voting delay" valueWidth="w-16" variant={variant} />
        <SkeletonStat label="Voting period" valueWidth="w-20" variant={variant} />
      </dl>
      <Skeleton variant={variant} className="mt-5 h-11 w-36 rounded-lg" />
    </article>
  );
}

export type SkeletonProposalRowProps = {
  variant?: SkeletonVariant;
  className?: string;
};

/**
 * Proposal history row chrome.
 *
 * Mirrors the ProposalSummaryCard layout (proposal id, state, description)
 * so the list does not jump when discovery resolves.
 */
export function SkeletonProposalRow({
  variant = "shimmer",
  className,
}: SkeletonProposalRowProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 ${className ?? ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton variant={variant} className="h-4 w-40" />
          <Skeleton variant={variant} className="h-4 w-16 shrink-0" />
        </div>
        <Skeleton variant={variant} className="mt-2 h-3 w-5/6" />
      </div>
      <Skeleton variant={variant} className="h-4 w-12 shrink-0" />
    </div>
  );
}
