import { Buffer } from "buffer";

/**
 * Shape-only placeholders. These are the right length and prefix for Stellar
 * strkeys but are NOT checksummed, which is fine because the mocks never parse
 * them through `Address`. Use real strkeys only if a test decodes them.
 */
function strkey(prefix: string): string {
  return (prefix + "A".repeat(56)).slice(0, 56);
}

export const MOCK_ACCOUNT_ALICE = strkey("GALICE");
export const MOCK_ACCOUNT_BOB = strkey("GBBOB");
export const MOCK_ACCOUNT_CAROL = strkey("GCCAROL");

export const MOCK_NFT_CONTRACT_ID = strkey("CNFT");
export const MOCK_GOVERNOR_CONTRACT_ID = strkey("CGOV");

/** 32-byte proposal identifiers, matching `BytesN<32>` on the contract. */
export const MOCK_PROPOSAL_ID = Buffer.from("11".repeat(32), "hex");
export const MOCK_SECOND_PROPOSAL_ID = Buffer.from("22".repeat(32), "hex");

export const MOCK_COLLECTION_NAME = "Stolla Community";
export const MOCK_COLLECTION_SYMBOL = "STOLLA";
export const MOCK_TOKEN_URI = "ipfs://bafyMockCollection/1.json";

/** A proposal payload shaped like the Governor's `propose` arguments. */
export const MOCK_PROPOSAL_INPUT = {
  targets: [MOCK_NFT_CONTRACT_ID],
  functions: ["mint"],
  args: [[MOCK_ACCOUNT_BOB, MOCK_TOKEN_URI]] as unknown[][],
  description: "Mint a membership NFT for Bob",
  proposer: MOCK_ACCOUNT_ALICE,
};

/** Normalises a proposal id so `Buffer` and hex string keys interchange. */
export function proposalKey(proposalId: Buffer | string): string {
  return typeof proposalId === "string"
    ? proposalId
    : proposalId.toString("hex");
}
