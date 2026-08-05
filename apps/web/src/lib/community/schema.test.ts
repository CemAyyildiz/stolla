import { describe, expect, it } from "vitest";
import {
  parseCommunityMetadata,
  validateCommunityMetadataDraft,
  type CommunityMetadataDraft,
} from "./schema";

const VALID_DRAFT: CommunityMetadataDraft = {
  name: "Builders Guild",
  symbol: "BUILD",
  description: "A community for public-goods builders.",
  collectionUri: "ipfs://bafy/collection.json",
  metadataUri: "https://builders.example/community.json",
  logo: "",
  externalLinkLabel: "",
  externalLinkUrl: "",
};

describe("community metadata schema", () => {
  it("accepts valid first-step input", () => {
    expect(validateCommunityMetadataDraft(VALID_DRAFT)).toEqual({});
  });

  it("rejects values outside every documented length or format class", () => {
    expect(
      validateCommunityMetadataDraft({
        ...VALID_DRAFT,
        name: "x".repeat(65),
        symbol: "lowercase",
        description: "x".repeat(2_001),
        collectionUri: "ftp://example.test/collection.json",
        metadataUri: `https://example.test/${"x".repeat(257)}`,
        logo: "http://example.test/logo.png",
        externalLinkLabel: "x".repeat(33),
        externalLinkUrl: "ipfs://not-an-external-link",
      }),
    ).toEqual({
      name: "Use at most 64 UTF-8 bytes and no control characters.",
      symbol: "Use 1–12 uppercase letters or numbers.",
      description: "Use at most 2,000 UTF-8 bytes.",
      collectionUri:
        "Use a valid ipfs:// or https:// URI of at most 256 bytes.",
      metadataUri:
        "Use a valid ipfs:// or https:// URI of at most 256 bytes.",
      logo: "Use a valid ipfs:// or https:// URI of at most 256 bytes.",
      externalLinkLabel:
        "Use at most 32 UTF-8 bytes and no control characters.",
      externalLinkUrl: "Use a valid https:// URL of at most 256 bytes.",
    });
  });

  it("parses version-1 metadata and rejects unknown or mismatched fields", () => {
    const metadata = {
      schemaVersion: 1,
      name: "Builders Guild",
      description: "Build together.",
      externalLinks: [
        { label: "Website", url: "https://builders.example" },
      ],
      nftContract: "CNFT",
      governorContract: "CGOV",
    };

    expect(
      parseCommunityMetadata(metadata, {
        nftContract: "CNFT",
        governorContract: "CGOV",
      }),
    ).toEqual({
      schemaVersion: 1,
      name: "Builders Guild",
      description: "Build together.",
      externalLinks: [
        { label: "Website", url: "https://builders.example" },
      ],
    });
    expect(
      parseCommunityMetadata(
        { ...metadata, governorContract: "COTHER" },
        { nftContract: "CNFT", governorContract: "CGOV" },
      ),
    ).toBeNull();
    expect(
      parseCommunityMetadata(
        { ...metadata, unknown: true },
        { nftContract: "CNFT", governorContract: "CGOV" },
      ),
    ).toBeNull();
  });
});
