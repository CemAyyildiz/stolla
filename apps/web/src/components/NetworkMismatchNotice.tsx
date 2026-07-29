import type { NetworkComparison } from "@/lib/network";

type Props = {
  comparison: NetworkComparison;
  /** Extra sentence describing what the mismatch has invalidated. */
  consequence?: string;
};

export function NetworkMismatchNotice({ comparison, consequence }: Props) {
  if (comparison.status !== "mismatch") return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-100"
    >
      <p className="font-semibold">Wrong wallet network</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-amber-300/70">Expected</dt>
          <dd className="font-medium">{comparison.expected.label}</dd>
        </div>
        <div>
          <dt className="text-amber-300/70">Detected</dt>
          <dd className="font-medium">{comparison.detected.label}</dd>
        </div>
      </dl>
      <p className="mt-3 text-amber-200/90">
        Switch your wallet back to {comparison.expected.label} to continue.
        {consequence ? ` ${consequence}` : ""}
      </p>
    </div>
  );
}
