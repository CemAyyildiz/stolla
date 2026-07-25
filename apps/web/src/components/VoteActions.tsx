"use client";

import { VOTE_OPTIONS, type VoteType } from "./voteOptions";

type VoteActionsProps = {
  disabled: boolean;
  pendingVote: VoteType | null;
  onVote: (voteType: VoteType) => void;
};

const voteStyles: Record<VoteType, string> = {
  1: "border-emerald-500/60 bg-emerald-600 hover:border-emerald-300 hover:bg-emerald-500",
  0: "border-rose-500/60 bg-rose-600 hover:border-rose-300 hover:bg-rose-500",
  2: "border-slate-500 bg-slate-600 hover:border-slate-300 hover:bg-slate-500",
};

export function VoteActions({
  disabled,
  pendingVote,
  onVote,
}: VoteActionsProps) {
  const isSubmitting = pendingVote !== null;

  return (
    <div
      aria-label="Vote options"
      className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-row sm:gap-2"
      role="group"
    >
      {VOTE_OPTIONS.map((option) => {
        const isPending = pendingVote === option.type;

        return (
          <button
            key={option.type}
            type="button"
            aria-busy={isPending}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-70 sm:w-auto ${voteStyles[option.type]}`}
            disabled={disabled || isSubmitting}
            onClick={() => onVote(option.type)}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
            >
              {isPending ? (
                <span className="animate-pulse">•••</span>
              ) : (
                option.symbol
              )}
            </span>
            <span>{isPending ? option.pendingLabel : option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
