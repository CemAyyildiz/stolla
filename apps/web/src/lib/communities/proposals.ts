"use client";

import { Buffer } from "buffer";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { createReadOnlyGovernorClientFor } from "@/lib/contracts";

export type ProposalReader = {
  proposal_state: (args: {
    proposal_id: Buffer;
  }) => Promise<{ result: ProposalState }>;
  proposal_proposer?: (args: {
    proposal_id: Buffer;
  }) => Promise<{ result: string | null }>;
};

export type ProposalReaderFactory = (governorContractId: string) => ProposalReader;

const defaultGetReader: ProposalReaderFactory = (governorContractId) =>
  createReadOnlyGovernorClientFor(governorContractId);

export type ProposalEntry =
  | { id: string; status: "ready"; state: ProposalState }
  | { id: string; status: "error"; error: string };

export type ProposalListResolution =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; entries: ProposalEntry[]; error?: string | null };

export function useCommunityProposals(
  governorContractId: string,
  proposalIds: string[],
  getReader: ProposalReaderFactory = defaultGetReader,
): ProposalListResolution {
  const idsKey = proposalIds.join(",");
  const scopeKey = `${governorContractId}|${idsKey}`;

  const [entries, setEntries] = useState<ProposalEntry[] | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);

  // Reset synchronously during render (not in an effect) so switching
  // communities never leaves the previous community's proposals on screen.
  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setEntries(null);
    setDiscoveryError(null);
  }

  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    let cancelled = false;
    let reader: ProposalReader;
    try {
      reader = getReader(governorContractId);
    } catch (error: unknown) {
      // This is an asynchronous dependency failure, not render-derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiscoveryError(
        error instanceof Error ? error.message : "Proposal discovery unavailable",
      );
      return () => {
        cancelled = true;
      };
    }
    const ids = idsKey ? idsKey.split(",") : [];

    Promise.all(
      ids.map(async (id): Promise<ProposalEntry> => {
        try {
          const tx = await reader.proposal_state({
            proposal_id: Buffer.from(id, "hex"),
          });
          return { id, status: "ready", state: tx.result };
        } catch (error: unknown) {
          return {
            id,
            status: "error",
            error: error instanceof Error ? error.message : "Failed to load proposal",
          };
        }
      }),
    ).then((results) => {
      if (cancelled || fetchIdRef.current !== fetchId) return;
      setEntries(results);
      setDiscoveryError(null);
    });

    return () => {
      cancelled = true;
    };
  }, [governorContractId, idsKey, getReader]);

  if (!entries) return discoveryError
    ? { status: "error", error: discoveryError }
    : { status: "loading" };
  return discoveryError
    ? { status: "error", error: discoveryError }
    : { status: "ready", entries };
}

export type ProposalResolution =
  | { status: "loading" }
  | { status: "ready"; state: ProposalState; proposer: string | null; refresh: () => void }
  | { status: "error"; error: string };

export function useCommunityProposal(
  governorContractId: string,
  proposalId: string,
  getReader: ProposalReaderFactory = defaultGetReader,
): ProposalResolution {
  const scopeKey = `${governorContractId}|${proposalId}`;

  const [state, setState] = useState<ProposalState | null>(null);
  const [proposer, setProposer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);
  const [refreshNonce, setRefreshNonce] = useState(0);

  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setState(null);
    setProposer(null);
    setError(null);
  }

  const fetchIdRef = useRef(0);
  const refresh = useCallback(() => {
    setRefreshNonce((nonce) => nonce + 1);
  }, []);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    let cancelled = false;
    const reader = getReader(governorContractId);
    const proposalKey = { proposal_id: Buffer.from(proposalId, "hex") };

    reader
      .proposal_state(proposalKey)
      .then(async (tx) => {
        if (cancelled || fetchIdRef.current !== fetchId) return;
        let nextProposer: string | null = null;
        if (typeof reader.proposal_proposer === "function") {
          try {
            const proposerTx = await reader.proposal_proposer(proposalKey);
            nextProposer = proposerTx.result ?? null;
          } catch {
            nextProposer = null;
          }
        }
        if (cancelled || fetchIdRef.current !== fetchId) return;
        setProposer(nextProposer);
        setState(tx.result);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled || fetchIdRef.current !== fetchId) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load proposal",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [governorContractId, proposalId, getReader, refreshNonce]);

  if (error) return { status: "error", error };
  if (state === null) return { status: "loading" };
  return { status: "ready", state, proposer, refresh };
}
