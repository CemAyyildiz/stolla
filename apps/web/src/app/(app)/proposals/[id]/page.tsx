"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient } from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTransactionLifecycle } from "@/hooks/useTransactionLifecycle";
import { TransactionLifecycleDisplay } from "@/components/TransactionLifecycleDisplay";
import { truncateMiddle } from "@/lib/truncate";

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

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalIdHex = params.id;
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<string>("—");
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);
  const [reason, setReason] = useState("Support");
  const [status, setStatus] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchProposalState = useCallback(async () => {
    if (!contractIds.governor || !proposalIdHex) return null;
    const client = createGovernorClient({
      publicKey: address ?? "",
      signTransaction,
    });
    const proposalId = Buffer.from(proposalIdHex, "hex");

    const [stateTx, votedTx] = await Promise.all([
      client.proposal_state({ proposal_id: proposalId }),
      address
        ? client.has_voted({ proposal_id: proposalId, account: address })
        : Promise.resolve(null),
    ]);

    return {
      state: stateTx.result ?? ProposalState.Pending,
      hasVoted: votedTx ? Boolean(votedTx.result) : null,
    };
  }, [address, proposalIdHex, signTransaction]);

  useEffect(() => {
    let active = true;

    fetchProposalState()
      .then((data) => {
        if (!active || !data) return;
        setState(stateLabels[data.state]);
        setHasVoted(data.hasVoted);
      })
      .catch((error: unknown) => {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Failed to load proposal");
        }
      })
      .finally(() => {
        if (active) {
          setInitialLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchProposalState]);

  // Transaction lifecycle management
  const { state: txLifecycle, execute: executeVote, reset: resetLifecycle } =
    useTransactionLifecycle({
      onConfirmed: async () => {
        // Refresh has_voted, proposal state, and available vote data after confirmation
        const data = await fetchProposalState();
        if (data) {
          setState(stateLabels[data.state]);
          setHasVoted(data.hasVoted);
        }
      },
    });

  async function handleVote(voteType: number) {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }

    setStatus(null);
    resetLifecycle();

    await executeVote(voteType, reason, async () => {
      const client = createGovernorClient({ publicKey: address, signTransaction });
      const tx = await client.cast_vote({
        proposal_id: Buffer.from(proposalIdHex, "hex"),
        vote_type: voteType,
        reason,
        voter: address,
      });
      // signAndSend handles wallet approval, network submission, and ledger confirmation
      await tx.signAndSend();
    });
  }

  // Disable voting buttons while a transaction is in progress
  const isVotingDisabled =
    !address ||
    txLifecycle.stage === "simulating" ||
    txLifecycle.stage === "wallet_approval" ||
    txLifecycle.stage === "submitting" ||
    txLifecycle.stage === "confirming";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
      <div className="mt-2 flex items-center gap-2">
        <p
          className="truncate font-mono text-sm text-slate-400"
          title={proposalIdHex}
        >
          {truncateMiddle(proposalIdHex)}
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(proposalIdHex)}
          className="shrink-0 rounded px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          title="Copy proposal ID"
          aria-label={`Copy proposal ID ${proposalIdHex}`}
        >
          Copy
        </button>
      </div>

      {initialLoading ? (
        <div className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">State</dt>
            <dd><Skeleton className="mt-0.5 h-5 w-24" /></dd>
          </div>
          <div>
            <dt className="text-slate-500">You voted</dt>
            <dd><Skeleton className="mt-0.5 h-5 w-16" /></dd>
          </div>
        </div>
      ) : (
        <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">State</dt>
            <dd className="font-medium text-slate-100">{state}</dd>
          </div>
          <div>
            <dt className="text-slate-500">You voted</dt>
            <dd>{hasVoted === null ? "—" : hasVoted ? "Yes" : "No"}</dd>
          </div>
        </dl>
      )}

      <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
        <h2 className="font-semibold text-slate-100">Cast vote</h2>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isVotingDisabled}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
          placeholder="Reason (optional)"
          aria-label="Vote reason"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleVote(1)}
            disabled={isVotingDisabled}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            aria-label="Vote For"
          >
            For
          </button>
          <button
            type="button"
            onClick={() => handleVote(0)}
            disabled={isVotingDisabled}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            aria-label="Vote Against"
          >
            Against
          </button>
          <button
            type="button"
            onClick={() => handleVote(2)}
            disabled={isVotingDisabled}
            className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
            aria-label="Vote Abstain"
          >
            Abstain
          </button>
        </div>
      </section>

      {/* Transaction lifecycle display */}
      <TransactionLifecycleDisplay
        stage={txLifecycle.stage}
        voteType={txLifecycle.voteType}
        reason={txLifecycle.reason}
        error={txLifecycle.error}
        isTerminal={txLifecycle.isTerminal}
      />

      {status && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-[#151b2b] p-3 text-sm text-slate-200">
          {status}
        </p>
      )}
    </div>
  );
}
