"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient, createReadOnlyGovernorClient } from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

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
  const [proposer, setProposer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reason, setReason] = useState("Support");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contractIds.governor || !proposalIdHex) return;
    const client = createGovernorClient({
      publicKey: address ?? "",
      signTransaction,
    });
    const readOnlyClient = createReadOnlyGovernorClient();
    const proposalId = Buffer.from(proposalIdHex, "hex");

    const [stateTx, votedTx] = await Promise.all([
      client.proposal_state({ proposal_id: proposalId }),
      address
        ? client.has_voted({ proposal_id: proposalId, account: address })
        : Promise.resolve(null),
    ]);

    setState(stateLabels[stateTx.result ?? ProposalState.Pending]);
    if (votedTx) {
      setHasVoted(Boolean(votedTx.result));
    }

    // Fetch proposer independently so a read failure doesn't hide state/voted data
    readOnlyClient
      .proposal_proposer({ proposal_id: proposalId })
      .then((tx) => setProposer(tx.result ?? null))
      .catch(() => setProposer(null));
  }, [address, proposalIdHex, signTransaction]);

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Failed to load proposal");
    });
  }, [refresh]);

  async function handleVote(voteType: number) {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = createGovernorClient({ publicKey: address, signTransaction });
      const tx = await client.cast_vote({
        proposal_id: Buffer.from(proposalIdHex, "hex"),
        vote_type: voteType,
        reason,
        voter: address,
      });
      await tx.signAndSend();
      setStatus("Vote submitted.");
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Proposal</h1>
      <p className="mt-2 break-all font-mono text-sm text-slate-400">
        {proposalIdHex}
      </p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">State</dt>
          <dd className="font-medium text-slate-100">{state}</dd>
        </div>
        <div>
          <dt className="text-slate-500">You voted</dt>
          <dd>{hasVoted === null ? "—" : hasVoted ? "Yes" : "No"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Proposer</dt>
          <dd className="mt-1">
            {proposer ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-sm text-slate-200" title={proposer}>
                  {shortenAddress(proposer)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(proposer);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // Clipboard API unavailable — no feedback needed
                    }
                  }}
                  aria-label={`Copy full proposer address ${proposer}`}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </span>
            ) : (
              <span className="text-slate-600">Unknown</span>
            )}
          </dd>
        </div>
      </dl>
      <div aria-live="polite" className="sr-only">
        {copied ? "Proposer address copied to clipboard" : null}
      </div>

      <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
        <h2 className="font-semibold text-slate-100">Cast vote</h2>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          placeholder="Reason (optional)"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleVote(1)}
            disabled={!address || loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            For
          </button>
          <button
            type="button"
            onClick={() => handleVote(0)}
            disabled={!address || loading}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Against
          </button>
          <button
            type="button"
            onClick={() => handleVote(2)}
            disabled={!address || loading}
            className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
          >
            Abstain
          </button>
        </div>
      </section>

      {status && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-[#151b2b] p-3 text-sm text-slate-200">
          {status}
        </p>
      )}
    </div>
  );
}
