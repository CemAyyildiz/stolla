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
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";

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
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [proposalIds, setProposalIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contractsConfigured = Boolean(contractIds.governor);

  const loadProposals = useCallback(async () => {
    const ids = getStoredProposalIds();
    setProposalIds(ids);
    if (!contractsConfigured || ids.length === 0) return;

    const client = createGovernorClient({
      publicKey: address ?? "",
      signTransaction,
    });

    const nextStates: Record<string, string> = {};
    for (const idHex of ids) {
      try {
        const tx = await client.proposal_state({
          proposal_id: Buffer.from(idHex, "hex"),
        });
        nextStates[idHex] = stateLabels[tx.result ?? ProposalState.Pending];
      } catch {
        nextStates[idHex] = "Unknown";
      }
    }
    setStates(nextStates);
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    loadProposals().catch(() => undefined);
  }, [loadProposals]);

  async function handleCreateProposal() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!description.trim()) {
      setDescriptionError("Proposal description is required.");
      setStatus(null);
      return;
    }

    setDescriptionError(null);
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
      setStatus(`Proposal created: ${idHex.slice(0, 12)}...`);
      await loadProposals();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Proposal failed");
    } finally {
      setLoading(false);
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
          <label
            htmlFor="proposal-description"
            className="mt-3 block text-sm text-slate-400"
          >
            Proposal description{" "}
            <span className="text-slate-500">(required)</span>
          </label>
          <textarea
            id="proposal-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDescriptionError(null);
            }}
            rows={3}
            required
            aria-describedby={`proposal-description-help${
              descriptionError ? " proposal-description-error" : ""
            }`}
            aria-invalid={Boolean(descriptionError)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="Describe the community decision..."
          />
          <p
            id="proposal-description-help"
            className="mt-1 text-xs text-slate-500"
          >
            Summarize the decision and intended action recorded with the proposal.
          </p>
          {descriptionError && (
            <p
              id="proposal-description-error"
              role="alert"
              className="mt-1 text-xs text-rose-300"
            >
              {descriptionError}
            </p>
          )}
          <button
            type="button"
            onClick={handleCreateProposal}
            disabled={!address || loading}
            className="mt-3 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Create proposal"}
          </button>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-100">Your proposals</h2>
        {proposalIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No proposals yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proposalIds.map((id) => (
              <li key={id}>
                <Link
                  href={`/proposals/${id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80"
                >
                  <span className="truncate font-mono">{id}</span>
                  <span className="ml-3 text-slate-500">{states[id] ?? "..."}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-[#151b2b] p-3 text-sm text-slate-200">
          {status}
        </p>
      )}
    </div>
  );
}
