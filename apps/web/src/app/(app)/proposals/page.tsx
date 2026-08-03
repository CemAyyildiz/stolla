"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import {
  createGovernorClient,
  storeProposalId,
} from "@/lib/contracts";
import { loadProposalList } from "@/lib/proposal-loader";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { truncateEnd, truncateMiddle } from "@/lib/truncate";
import { LiveStatus } from "@/components/ui/LiveStatus";

type ProposalLoadStatus = "loading" | "empty" | "error" | "populated";
type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

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
  const [failedProposalIds, setFailedProposalIds] = useState<string[]>([]);
  const [proposalLoadStatus, setProposalLoadStatus] =
    useState<ProposalLoadStatus>("loading");
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contractsConfigured = Boolean(contractIds.governor);
  const fetchRef = useRef(0);

  const loadProposals = useCallback(async () => {
    const requestId = ++fetchRef.current;
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

    if (fetchRef.current === requestId) {
      setProposalIds(result.proposalIds);
      setStates(result.states);
      setFailedProposalIds(result.failedIds);
      setProposalLoadStatus(result.status);
    }
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProposals();
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      fetchRef.current += 1;
    };
  }, [loadProposals]);

  async function handleCreateProposal() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    if (!description.trim()) {
      setDescriptionError("Proposal description is required.");
      setStatus(null);
      return;
    }

    setDescriptionError(null);
    setSubmitting(true);
    setStatus({
      message: "Submitting proposal transaction…",
      tone: "routine",
    });
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
      setStatus({
        message: `Proposal created: ${truncateEnd(idHex, 12)}`,
        tone: "routine",
      });
      await loadProposals();
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : "Proposal failed",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
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
            className="mt-1 box-border w-full min-w-0 resize-y rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
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
            disabled={!address || submitting}
            className="mt-3 min-h-11 w-full touch-manipulation rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Submitting..." : "Create proposal"}
          </button>
          {status && (
            <LiveStatus
              tone={status.tone}
              className={`mt-3 min-w-0 break-words rounded-lg border bg-[#0b0f19] p-3 text-sm [overflow-wrap:anywhere] ${
                status.tone === "error"
                  ? "border-rose-800/70 text-rose-200"
                  : "border-slate-800 text-slate-200"
              }`}
            >
              {status.message}
            </LiveStatus>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-100">Your proposals</h2>
        <div>
          {proposalLoadStatus === "loading" && (
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
          )}

          {proposalLoadStatus === "loading" && (
            <LiveStatus className="sr-only">
              Loading proposal history...
            </LiveStatus>
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
                onClick={() => void loadProposals()}
                className="mt-3 min-h-11 touch-manipulation rounded-lg border border-rose-600 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              >
                Retry loading proposals
              </button>
            </div>
          )}

          {proposalLoadStatus === "empty" && (
            <LiveStatus className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
              No proposals yet.
            </LiveStatus>
          )}

          {proposalLoadStatus === "populated" && (
            <>
              {failedProposalIds.length === 0 && (
                <LiveStatus className="sr-only">
                  Proposal history loaded.
                </LiveStatus>
              )}
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
                    onClick={() => void loadProposals()}
                    className="min-h-11 shrink-0 touch-manipulation self-start rounded-lg border border-amber-600 px-3 py-2 font-medium hover:bg-amber-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:self-auto"
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
                      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#151b2b] px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/80">
                        <Link
                          href={`/proposals/${id}`}
                          className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                        >
                          <span className="truncate font-mono" title={id}>
                            {truncateMiddle(id)}
                          </span>
                          <span
                            className={
                              stateFailed
                                ? "shrink-0 text-amber-300"
                                : "shrink-0 text-slate-500"
                            }
                          >
                            {stateFailed
                              ? "Unavailable"
                              : (states[id] ?? "Not loaded")}
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
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
