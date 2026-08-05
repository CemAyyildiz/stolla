import { describe, expect, it } from "vitest";
import { isCommunityId, parseRegistryRecord } from "./registry";

function bytes(value: number) {
  return Uint8Array.from({ length: 32 }, () => value);
}

describe("community registry decoding", () => {
  it("decodes the canonical factory record", () => {
    expect(
      parseRegistryRecord({
        community_id: bytes(0xab),
        nft_contract: "CNFT",
        governor_contract: "CGOV",
        creator: "GCREATOR",
        community_owner: "GOWNER",
        created_at_ledger: 123,
        creation_index: 4,
        metadata_uri: "ipfs://bafy/community.json",
        metadata_hash: bytes(0xcd),
        metadata_schema_version: 1,
      }),
    ).toEqual({
      id: "ab".repeat(32),
      nftContract: "CNFT",
      governorContract: "CGOV",
      creator: "GCREATOR",
      communityOwner: "GOWNER",
      createdAtLedger: 123,
      creationIndex: 4,
      metadataUri: "ipfs://bafy/community.json",
      metadataHash: "cd".repeat(32),
      metadataSchemaVersion: 1,
    });
  });

  it("rejects malformed records and unsupported schema versions", () => {
    expect(parseRegistryRecord({})).toBeNull();
    expect(
      parseRegistryRecord({
        community_id: bytes(1),
        nft_contract: "CNFT",
        governor_contract: "CGOV",
        creator: "GCREATOR",
        community_owner: "GOWNER",
        created_at_ledger: 123,
        creation_index: 4,
        metadata_uri: "https://example.test/community.json",
        metadata_hash: bytes(2),
        metadata_schema_version: 2,
      }),
    ).toBeNull();
  });

  it("accepts only canonical 32-byte route IDs", () => {
    expect(isCommunityId("ab".repeat(32))).toBe(true);
    expect(isCommunityId("AB".repeat(32))).toBe(true);
    expect(isCommunityId("ab".repeat(31))).toBe(false);
    expect(isCommunityId("z".repeat(64))).toBe(false);
  });
});
