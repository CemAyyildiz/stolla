"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import {
  createGovernorClient,
  getStoredProposalIds,
  storeProposalId,
} from "@/lib/contracts";
import { loadProposalList } from "@/lib/proposal-loader.mjs";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";

type ProposalLoadStatus = "loading" | "empty" | "error" | "populated";

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
  const [proposalIds, setProposalIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const [failedProposalIds, setFailedProposalIds] = useState<string[]>([]);
  const [proposalLoadStatus, setProposalLoadStatus] =
    useState<ProposalLoadStatus>("loading");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contractsConfigured = Boolean(contractIds.governor);

  const loadProposals = useCallback(async () => {
    setProposalLoadStatus("loading");

    let client: ReturnType<typeof createGovernorClient> | undefined;
    const result = await loadProposalList({
      getProposalIds: getStoredProposalIds,
      loadProposalState: contractsConfigured
        ? async (idHex) => {
            client ??= createGovernorClient({
              publicKey: address ?? "",
              signTransaction,
            });
            const tx = await client.proposal_state({
              proposal_id: Buffer.from(idHex, "hex"),
            });
            return stateLabels[tx.result ?? ProposalState.Pending];
          }
        : undefined,
    });

    setProposalIds(result.proposalIds);
    setStates(result.states);
    setFailedProposalIds(result.failedIds);
    setProposalLoadStatus(result.status);
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProposals();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadProposals]);

  async function handleCreateProposal() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!description.trim()) {
      setStatus("Description is required.");
      return;
    }

    setSubmitting(true);
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
      setStatus(`Proposal created: ${idHex.slice(0, 12)}...`);
      await loadProposals();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Proposal failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
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
        <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
          <h2 className="font-semibold text-slate-100">Create proposal</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="Describe the community decision..."
          />
          <button
            type="button"
            onClick={handleCreateProposal}
            disabled={!address || submitting}
            className="mt-3 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Create proposal"}
          </button>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-100">Your proposals</h2>
        <div aria-live="polite">
          {proposalLoadStatus === "loading" && (
            <p
              className="mt-3 rounded-lg border border-slate-800 bg-[#151b2b] p-4 text-sm text-slate-400"
              role="status"
            >
              Loading proposal history...
            </p>
          )}

          {proposalLoadStatus === "error" && (
            <div
              className="mt-3 rounded-lg border border-rose-800/70 bg-rose-950/40 p-4"
              role="alert"
            >
              <p className="font-medium text-rose-200">
                Proposal history is temporarily unavailable.
              </p>
              <p className="mt-1 text-sm text-rose-300/80">
                Check your connection and try loading the proposals again.
              </p>
              <button
                type="button"
                onClick={loadProposals}
                className="mt-3 rounded-lg border border-rose-600 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              >
                Retry loading proposals
              </button>
            </div>
          )}

          {proposalLoadStatus === "empty" && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
              No proposals yet.
            </p>
          )}

          {proposalLoadStatus === "populated" && (
            <>
              {failedProposalIds.length > 0 && (
                <div
                  className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                >
                  <p>
                    Some proposal states could not be loaded. Available
                    proposals are shown below.
                  </p>
                  <button
                    type="button"
                    onClick={loadProposals}
                    className="shrink-0 self-start rounded-lg border border-amber-600 px-3 py-2 font-medium hover:bg-amber-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:self-auto"
                  >
                    Retry loading proposals
                  </button>
                </div>
              )}
              <ul className="mt-3 space-y-2">
                {proposalIds.map((id) => {
                  const stateFailed = failedProposalIds.includes(id);
                  return (
                    <li key={id}>
                      <Link
                        href={`/proposals/${id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                      >
                        <span className="truncate font-mono">{id}</span>
                        <span
                          className={
                            stateFailed
                              ? "ml-3 text-amber-300"
                              : "ml-3 text-slate-500"
                          }
                        >
                          {stateFailed
                            ? "Unavailable"
                            : (states[id] ?? "Not loaded")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
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
