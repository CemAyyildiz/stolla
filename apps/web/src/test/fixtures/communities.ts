import type { CommunityRecord, CommunityMetadata } from "@/lib/communities/types";

/**
 * Reusable multi-community fixture set for navigation/routing tests.
 *
 * - `atlas` and `beacon` are two fully independent communities (distinct
 *   Governor + NFT contract ids) used to prove route-context scoping and
 *   that switching communities never leaks state between them.
 * - `driftwood` has no `metadataUri`, so its off-chain description always
 *   fails to resolve while its on-chain identifiers must still render.
 */
export const atlasCommunity: CommunityRecord = {
  id: "atlas-collective",
  name: "Atlas Collective",
  symbol: "ATLAS",
  governorContractId: "CGOVERNORATLAS00000000000000000000000000000000000000001",
  nftContractId: "CNFTATLAS000000000000000000000000000000000000000000001",
  metadataUri: "https://metadata.example/atlas.json",
};

export const beaconCommunity: CommunityRecord = {
  id: "beacon-guild",
  name: "Beacon Guild",
  symbol: "BEACON",
  governorContractId: "CGOVERNORBEACON0000000000000000000000000000000000000002",
  nftContractId: "CNFTBEACON00000000000000000000000000000000000000000002",
  metadataUri: "https://metadata.example/beacon.json",
};

export const driftwoodCommunity: CommunityRecord = {
  id: "driftwood-cooperative",
  name: "Driftwood Cooperative",
  symbol: "DRIFT",
  governorContractId: "CGOVERNORDRIFTWOOD000000000000000000000000000000000003",
  nftContractId: "CNFTDRIFTWOOD0000000000000000000000000000000000000000003",
  // Intentionally no metadataUri: models a community missing off-chain metadata.
};

export const multiCommunityRegistry: CommunityRecord[] = [
  atlasCommunity,
  beaconCommunity,
  driftwoodCommunity,
];

export const atlasMetadata: CommunityMetadata = {
  description: "Funding public goods across the Atlas ecosystem.",
  logoUri: "https://metadata.example/atlas-logo.png",
};

export const beaconMetadata: CommunityMetadata = {
  description: "Coordinating grants for the Beacon Guild.",
  logoUri: "https://metadata.example/beacon-logo.png",
};

export function createFetchMetadata(
  byUri: Record<string, CommunityMetadata | Error>,
) {
  return async (uri: string): Promise<CommunityMetadata> => {
    const outcome = byUri[uri];
    if (outcome === undefined) {
      throw new Error(`No fixture metadata for ${uri}`);
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome;
  };
}
