"use client";

import { useCallback, useEffect, useState } from "react";
import { xdr } from "@stellar/stellar-sdk";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import type { Api } from "@stellar/stellar-sdk/rpc";
import { config } from "@/lib/stellar";
import { requireContractIds } from "@/lib/stellar";
import { decodeProposalEvent } from "@/lib/proposalEvents";

export type DiscoveredProposal = {
  id: string;
  /** Proposal description from the created event, or null when unavailable. */
  description: string | null;
};

function extractDescription(event: Api.EventResponse): string | null {
  const decoded = decodeProposalEvent({
    type: event.type,
    contractId: event.contractId,
    topic: event.topic,
    value: event.value,
  });
  if (decoded.ok && decoded.event.kind === "proposal_created") {
    return decoded.event.description;
  }

  try {
    if (event.value.switch().name !== "scvVec") return null;
    const fields = event.value.vec();
    const descriptionVal = fields?.[5];
    if (!descriptionVal || descriptionVal.switch().name !== "scvString") {
      return null;
    }
    return descriptionVal.str() as string;
  } catch {
    return null;
  }
}

export function useProposalDiscovery() {
  const [proposals, setProposals] = useState<DiscoveredProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const discover = useCallback(async () => {
    const { governor } = requireContractIds();
    const server = new RpcServer(config.rpcUrl);

    const proposalCreatedTopic = xdr
      .ScVal.scvString("proposal_created")
      .toXDR("base64");

    setLoading(true);
    setError(null);
    setEmpty(false);

    try {
      const discovered: DiscoveredProposal[] = [];
      let cursor: string | undefined = undefined;

      for (;;) {
        const request:
          | {
              filters: { contractIds: string[]; topics: string[][] }[];
              startLedger: number;
              limit?: number;
              cursor?: never;
            }
          | {
              filters: { contractIds: string[]; topics: string[][] }[];
              cursor: string;
              startLedger?: never;
              limit?: number;
            } = cursor
          ? {
              filters: [
                {
                  contractIds: [governor],
                  topics: [[proposalCreatedTopic]],
                },
              ],
              cursor,
              limit: 100,
            }
          : {
              filters: [
                {
                  contractIds: [governor],
                  topics: [[proposalCreatedTopic]],
                },
              ],
              startLedger: 1,
              limit: 100,
            };

        const response = await server.getEvents(request);

        for (const event of response.events) {
          if (event.topic.length < 2) continue;
          const proposalIdScVal = event.topic[1];
          if (proposalIdScVal.switch().name !== "scvBytes") continue;
          const proposalIdBytes = proposalIdScVal.bytes();
          if (!proposalIdBytes) continue;
          discovered.push({
            id: Buffer.from(proposalIdBytes).toString("hex"),
            description: extractDescription(event),
          });
        }

        if (!response.events.length || !response.cursor) break;
        cursor = response.cursor;
      }

      discovered.reverse();
      setProposals(discovered);
      setEmpty(discovered.length === 0);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Discovery failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    discover().catch(() => undefined);
  }, [discover]);

  const proposalIds = proposals.map((proposal) => proposal.id);

  return {
    proposals,
    proposalIds,
    loading,
    error,
    empty,
    refresh: discover,
  };
}
