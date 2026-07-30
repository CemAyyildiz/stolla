import { SorobanRpc } from "@stellar/stellar-sdk";
import retry from "async-retry";
import { config, contractIds } from "./stellar";

const PROPOSAL_TOPICS = [
  "proposal_created",
  "proposal_executed",
  "proposal_cancelled",
  "vote_cast",
];

/**
 * Queries the Soroban RPC for proposal events.
 *
 * @param startLedger - The starting ledger number to search from.
 * @param cursor - Optional cursor for pagination.
 * @returns A page of proposal events, the latest ledger, and a response cursor.
 */
export async function getProposalEvents(
  startLedger: number,
  cursor?: string,
) {
  const { governor } = contractIds;

  if (!governor) {
    throw new Error(
      "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }

  const server = new SorobanRpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });

  const response = await retry(
    async () =>
      server.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [governor],
          },
          {
            type: "topic",
            // The `getEvents` method in the version of the SDK being used does not
            // support OR filters on topics. It only supports a single list of topic
            // segments that are AND-ed.
            //
            // A wildcard '*' can be used to match any topic segment. To match all
            // four of the proposal topics, a wildcard is used for the event name.
            // This means the filter will match ANY event from the governor contract,
            // and the caller will need to perform a second level of filtering.
            //
            // NOTE: If the SDK is updated to support OR filters, this can be
            // updated to be more specific. For example:
            //
            // segments: PROPOSAL_TOPICS.map(topic => [topic])
            segments: ["*"],
          },
        ],
        cursor,
        limit: 10,
      }),
    {
      retries: 3, // Attempt a total of 4 times
    },
  );

  // The RPC server may return events that are not in our PROPOSAL_TOPICS list
  // because we are using a wildcard. This filters those out.
  const filteredEvents =
    response.events?.filter((event) => {
      const eventName = event.topic[0].toString();
      return PROPOSAL_TOPICS.includes(eventName);
    }) ?? [];

  return {
    events: filteredEvents,
    latestLedger: response.latestLedger,
    cursor: response.cursor,
  };
}