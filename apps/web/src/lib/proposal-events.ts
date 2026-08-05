import { rpc, xdr } from "@stellar/stellar-sdk";
import {
  config,
  contractIds,
  requireGovernorStartLedger,
} from "./stellar";

export const PROPOSAL_EVENT_NAMES = [
  "proposal_created",
  "proposal_executed",
  "proposal_cancelled",
  "vote_cast",
] as const;

const PROPOSAL_EVENT_TOPIC_FILTERS = PROPOSAL_EVENT_NAMES.map((name) => [
  xdr.ScVal.scvSymbol(name).toXDR("base64"),
]);

export type ProposalEventsPage = {
  events: rpc.Api.EventResponse[];
  latestLedger: number;
  cursor: string;
};

/**
 * Queries the Soroban RPC for proposal events.
 *
 * Uses `NEXT_PUBLIC_GOVERNOR_START_LEDGER` as the lower ledger boundary.
 *
 * @param cursor - Optional cursor for pagination.
 * @returns A page of proposal events, the latest ledger, and a response cursor.
 */
export async function getProposalEvents(
  cursor?: string,
): Promise<ProposalEventsPage> {
  const { governor } = contractIds;
  const startLedger = requireGovernorStartLedger();

  if (!governor) {
    throw new Error(
      "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }

  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const filters = [
    {
      type: "contract" as const,
      contractIds: [governor],
      topics: PROPOSAL_EVENT_TOPIC_FILTERS,
    },
  ];

  try {
    const response = await server.getEvents(
      cursor
        ? ({
            startLedger,
            filters,
            cursor,
            limit: 10,
          } as unknown as Parameters<rpc.Server["getEvents"]>[0])
        : ({
            startLedger,
            filters,
            limit: 10,
          } as unknown as Parameters<rpc.Server["getEvents"]>[0]),
    );

    return {
      events: response.events ?? [],
      latestLedger: response.latestLedger,
      cursor: response.cursor,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown RPC query failure.";

    throw new Error(
      `Failed to query governor proposal events: ${message}`,
    );
  }
}
