"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient } from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";
import { parseProposalId } from "@/lib/proposals";
import { useTransactionLifecycle } from "@/hooks/useTransactionLifecycle";
import { TransactionLifecycleDisplay } from "@/components/TransactionLifecycleDisplay";

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

type ProposalResult = {
  id: string;
  state: string;
  hasVoted: boolean | null;
};

const backLinkClassName =
  "mt-4 inline-block rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400";

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalIdHex = params.id;
  const isValidId = parseProposalId(proposalIdHex) !== null;
  const { address, signTransaction } = useWallet();
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [loadErrorId, setLoadErrorId] = useState<string | null>(null);
  const [reason, setReason] = useState("Support");
  const [status, setStatus] = useState<string | null>(null);

  const loadProposal = useCallback(async () => {
    const proposalId = parseProposalId(proposalIdHex);
    if (!proposalId || !contractIds.governor) {
      throw new Error("Proposal unavailable");
    }
    const client = createGovernorClient({
      publicKey: address ?? "",
      signTransaction,
    });

    const [stateTx, votedTx] = await Promise.all([
      client.proposal_state({ proposal_id: proposalId }),
      address
        ? client.has_voted({ proposal_id: proposalId, account: address })
        : Promise.resolve(null),
    ]);

    return {
      id: proposalIdHex,
      state: stateLabels[stateTx.result ?? ProposalState.Pending],
      hasVoted: votedTx ? Boolean(votedTx.result) : null,
    };
  }, [address, proposalIdHex, signTransaction]);

  useEffect(() => {
    if (!isValidId) return;
    loadProposal()
      .then((data) => {
        setLoadErrorId(null);
        setResult(data);
      })
      .catch(() => setLoadErrorId(proposalIdHex));
  }, [isValidId, loadProposal, proposalIdHex]);

  // Transaction lifecycle management
  const { state: txLifecycle, execute: executeVote, reset: resetLifecycle } =
    useTransactionLifecycle({
      onConfirmed: async () => {
        // Refresh has_voted, proposal state, and available vote data after confirmation
        const data = await loadProposal();
        setResult(data);
      },
    });

  async function handleVote(voteType: number) {
    const proposalId = parseProposalId(proposalIdHex);
    if (!proposalId) return;
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }

    setStatus(null);
    resetLifecycle();

    await executeVote(voteType, reason, async () => {
      const client = createGovernorClient({ publicKey: address, signTransaction });
      const tx = await client.cast_vote({
        proposal_id: proposalId,
        vote_type: voteType,
        reason,
        voter: address,
      });
      // signAndSend handles wallet approval, network submission, and ledger confirmation
      await tx.signAndSend();
    });
  }

  const isInvalid = !isValidId;
  const isNotFound = !isInvalid && loadErrorId === proposalIdHex;
  const isReady = !isInvalid && !isNotFound && result?.id === proposalIdHex;
  const isLoading = !isInvalid && !isNotFound && !isReady;

  // Disable voting buttons while a transaction is in progress
  const isVotingDisabled =
    !address ||
    txLifecycle.stage === "simulating" ||
    txLifecycle.stage === "wallet_approval" ||
    txLifecycle.stage === "submitting" ||
    txLifecycle.stage === "confirming";

  if (isInvalid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-100">
          Invalid proposal ID
        </h1>
        <p className="mt-2 break-all text-slate-400">
          <code className="font-mono">{proposalIdHex}</code> is not a valid
          32-byte proposal identifier.
        </p>
        <Link href="/proposals" className={backLinkClassName}>
          Back to proposals
        </Link>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-100">
          Proposal not found
        </h1>
        <p className="mt-2 break-all text-slate-400">
          We couldn&apos;t find a proposal with ID{" "}
          <code className="font-mono">{proposalIdHex}</code>. It may not exist
          or isn&apos;t available on this network.
        </p>
        <Link href="/proposals" className={backLinkClassName}>
          Back to proposals
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
        <p className="mt-2 text-slate-500">Loading proposal…</p>
      </div>
    );
  }

  const proposal = result!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
      <p className="mt-2 break-all font-mono text-sm text-slate-400">
        {proposalIdHex}
      </p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">State</dt>
          <dd className="font-medium text-slate-100">{proposal.state}</dd>
        </div>
        <div>
          <dt className="text-slate-500">You voted</dt>
          <dd>
            {proposal.hasVoted === null ? "—" : proposal.hasVoted ? "Yes" : "No"}
          </dd>
        </div>
      </dl>

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
