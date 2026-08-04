"use client";

import { useCallback, useEffect, useState } from "react";
import { xdr } from "@stellar/stellar-sdk";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { config } from "@/lib/stellar";
import { requireContractIds } from "@/lib/stellar";

export function useProposalDiscovery() {
  const [proposalIds, setProposalIds] = useState<string[]>([]);
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
      const ids: string[] = [];
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
          if (proposalIdBytes) {
            ids.push(Buffer.from(proposalIdBytes).toString("hex"));
          }
        }

        if (!response.events.length || !response.cursor) break;
        cursor = response.cursor;
      }

      ids.reverse();
      setProposalIds(ids);
      setEmpty(ids.length === 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    discover().catch(() => undefined);
  }, [discover]);

  return { proposalIds, loading, error, empty, refresh: discover };
}