import { config } from "./stellar";

export interface GovernorEventQueryOptions {
  startLedger: number;
  cursor?: string;
}

export interface GovernorEventPage<T = unknown> {
  events: T[];
  latestLedger: number;
  cursor?: string;
}

export async function queryGovernorEvents(
  governorContractId: string,
  options: GovernorEventQueryOptions,
): Promise<GovernorEventPage> {
  if (!governorContractId) {
    throw new Error("Governor contract ID is not configured.");
  }

  // TODO(issue-37):
  // Create a read-only Stellar RPC client.
  // Query Governor events for the configured contract.
  // Return normalized event data without React or browser dependencies.

  void config.rpcUrl;
  void options;

  return {
    events: [],
    latestLedger: options.startLedger,
    cursor: options.cursor,
  };
}