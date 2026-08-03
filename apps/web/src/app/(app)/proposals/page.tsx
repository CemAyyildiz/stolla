"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import {
  createGovernorClient,
  getStoredProposalIds,
  storeProposalId,
} from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { truncateEnd, truncateMiddle } from "@/lib/truncate";

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

export default function ProposalsPage() {
  const { address, signTransaction } = useWallet();
  const [description, setDescription] = useState("");
  const [proposalIds, setProposalIds] = useState<string[]>(() => getStoredProposalIds());
  const [states, setStates] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(
    () => Boolean(contractIds.governor) && proposalIds.length > 0,
  );

  const contractsConfigured = Boolean(contractIds.governor);

  const fetchRef = useRef(0);

  useEffect(() => {
    if (!contractsConfigured || proposalIds.length === 0) return;

    const id = ++fetchRef.current;
    let cancelled = false;

    const fetchStates = async () => {
      try {
        const client = createGovernorClient({
          publicKey: address ?? "",
          signTransaction,
        });

        const nextStates: Record<string, string> = {};
        for (const idHex of proposalIds) {
          if (cancelled || fetchRef.current !== id) return;
          try {
            const tx = await client.proposal_state({
              proposal_id: Buffer.from(idHex, "hex"),
            });
            nextStates[idHex] = stateLabels[tx.result ?? ProposalState.Pending];
          } catch {
            nextStates[idHex] = "Unknown";
          }
        }
        if (!cancelled && fetchRef.current === id) {
          setStates(nextStates);
        }
      } finally {
        if (!cancelled && fetchRef.current === id) {
          setInitialLoading(false);
        }
      }
    };

    fetchStates();
    return () => {
      cancelled = true;
    };
  }, [contractsConfigured, proposalIds, address, signTransaction]);

  async function handleCreateProposal() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!description.trim()) {
      setStatus("Description is required.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = createGovernorClient({ publicKey: address, signTransaction });
      const target = address;
      const tx = await client.propose({
        targets: [target],
        functions: ["noop"],
        args: [[]],
        description: description.trim(),
        proposer: address,
      });
      const result = await tx.signAndSend();
      const idHex = Buffer.from(result.result).toString("hex");
      storeProposalId(idHex);
      setDescription("");
      setStatus(`Proposal created: ${truncateEnd(idHex, 12)}`);
      setProposalIds(getStoredProposalIds());
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Proposal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Proposals</h1>
      <p className="mt-2 text-slate-400">
        Create and track DAO proposals. Voting power requires delegated NFTs.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200">
          Set <code className="font-mono">NEXT_PUBLIC_GOVERNOR_CONTRACT_ID</code>{" "}
          in <code className="font-mono">.env.local</code> after deployment.
        </p>
      )}

      {contractsConfigured && (
        <section className="mt-6 min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
          <h2 className="font-semibold text-slate-100">Create proposal</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-3 box-border w-full min-w-0 resize-y rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            placeholder="Describe the community decision..."
          />
          <button
            type="button"
            onClick={handleCreateProposal}
            disabled={!address || loading}
            className="mt-3 min-h-11 w-full touch-manipulation rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Submitting..." : "Create proposal"}
          </button>
          {status && (
            <p
              role="status"
              aria-live="polite"
              className="mt-3 min-w-0 break-words rounded-lg border border-slate-800 bg-[#0b0f19] p-3 text-sm text-slate-200 [overflow-wrap:anywhere]"
            >
              {status}
            </p>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-100">Your proposals</h2>
        {initialLoading ? (
          <ul className="mt-3 space-y-2">
            {Array.from({ length: Math.max(proposalIds.length || 3, 1) }).map(
              (_, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : proposalIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No proposals yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proposalIds.map((id) => (
              <li key={id}>
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80">
                  <Link
                    href={`/proposals/${id}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <span className="truncate font-mono" title={id}>
                      {truncateMiddle(id)}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {states[id] ?? "..."}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(id)}
                    className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
                    title="Copy proposal ID"
                    aria-label={`Copy proposal ID ${id}`}
                  >
                    Copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
