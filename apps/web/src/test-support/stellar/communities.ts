import { Buffer } from "buffer";

import { ProposalState } from "../../lib/bindings/community-governor/src";
import type {
  ProposalReader,
  ProposalReaderFactory,
} from "../../lib/communities/proposals";
import type {
  CommunityMetadata,
  CommunityRecord,
} from "../../lib/communities/types";
import {
  MOCK_ATLAS_GOVERNOR_ID,
  MOCK_ATLAS_NFT_ID,
  MOCK_BEACON_GOVERNOR_ID,
  MOCK_BEACON_NFT_ID,
  MOCK_DRIFT_GOVERNOR_ID,
  MOCK_DRIFT_NFT_ID,
} from "./fixtures";

export function createCommunityRecord(
  overrides: Partial<CommunityRecord> = {},
): CommunityRecord {
  return {
    id: "atlas-collective",
    name: "Atlas Collective",
    symbol: "ATLAS",
    governorContractId: MOCK_ATLAS_GOVERNOR_ID,
    nftContractId: MOCK_ATLAS_NFT_ID,
    metadataUri: "https://metadata.example.test/atlas.json",
    ...overrides,
  };
}

export const atlasCommunity = createCommunityRecord();
export const beaconCommunity = createCommunityRecord({
  id: "beacon-guild",
  name: "Beacon Guild",
  symbol: "BEACON",
  governorContractId: MOCK_BEACON_GOVERNOR_ID,
  nftContractId: MOCK_BEACON_NFT_ID,
  metadataUri: "https://metadata.example.test/beacon.json",
});
export const driftwoodCommunity = createCommunityRecord({
  id: "driftwood-cooperative",
  name: "Driftwood Cooperative",
  symbol: "DRIFT",
  governorContractId: MOCK_DRIFT_GOVERNOR_ID,
  nftContractId: MOCK_DRIFT_NFT_ID,
  metadataUri: undefined,
});

export function createCommunityRegistry(
  ...communities: CommunityRecord[]
): CommunityRecord[] {
  return communities.length > 0
    ? [...communities]
    : [atlasCommunity, beaconCommunity, driftwoodCommunity];
}

export const multiCommunityRegistry = createCommunityRegistry();

export const atlasMetadata: CommunityMetadata = {
  description: "Funding public goods across the Atlas ecosystem.",
  logoUri: "https://metadata.example.test/atlas-logo.png",
};
export const beaconMetadata: CommunityMetadata = {
  description: "Coordinating grants for the Beacon Guild.",
  logoUri: "https://metadata.example.test/beacon-logo.png",
};

export function createFetchMetadata(
  byUri: Record<string, CommunityMetadata | Error>,
) {
  return async (uri: string): Promise<CommunityMetadata> => {
    const outcome = byUri[uri];
    if (outcome === undefined) {
      throw new Error(`No fixture metadata for ${uri}`);
    }
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
}

export type GovernorFixture = {
  contractId: string;
  proposals: Record<string, ProposalState | Error>;
};

export type GovernorReaderFactoryMock = ProposalReaderFactory & {
  calls: Array<{ contractId: string; proposalId: string }>;
};

/** Creates per-contract proposal readers without Vitest spies or RPC access. */
export function createGovernorReaderFactory(
  fixtures: GovernorFixture[],
): GovernorReaderFactoryMock {
  const byContractId = new Map(
    fixtures.map((fixture) => [fixture.contractId, fixture]),
  );
  const calls: Array<{ contractId: string; proposalId: string }> = [];

  const factory = ((contractId: string): ProposalReader => ({
    proposal_state: async ({ proposal_id }: { proposal_id: Buffer }) => {
      const proposalId = proposal_id.toString("hex");
      calls.push({ contractId, proposalId });
      const outcome = byContractId.get(contractId)?.proposals[proposalId];
      if (outcome === undefined) {
        throw new Error(
          `No fixture proposal ${proposalId} for governor ${contractId}`,
        );
      }
      if (outcome instanceof Error) throw outcome;
      return { result: outcome };
    },
  })) as GovernorReaderFactoryMock;

  factory.calls = calls;
  return factory;
}
