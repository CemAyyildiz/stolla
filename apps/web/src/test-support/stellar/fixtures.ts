import { Buffer } from "buffer";

/**
 * Deterministic, checksum-valid Stellar addresses for tests.
 *
 * Generated once via:
 *   Address.contract(sha256(`stolla-fixture:${label}`)).toString()
 *   Keypair.fromRawEd25519Seed(sha256(`stolla-fixture:${label}`)).publicKey()
 *
 * Do not invent IDs with `.repeat()` or zero-padding — use a new labeled
 * hash-derived address instead.
 */
export const MOCK_ACCOUNT_ALICE =
  "GD4GQO72YZ6LTEKTLCZRLXB6YKX7WM5NTOJNLXU75PPYRWXWUY23BZ2O";
export const MOCK_ACCOUNT_BOB =
  "GDQWJTU6FH5MT4GHDAEWRHWQX4FYVFX2WCDA4IYCEP6D7MGCEZ6IYQPH";
export const MOCK_ACCOUNT_CAROL =
  "GCOBUNKHVDEQL3DAP75EMVJCMV3LCFRUIPEXCHYG2FFCJQ2LJNUBMO56";
export const MOCK_ACCOUNT_CREATOR =
  "GATKER6BC7PCXDVVGPO3JQQJZ54DXLNA4ZCOC7HZNVLP66IAY5DTZMKO";
export const MOCK_ACCOUNT_OWNER =
  "GBF7P3QLZPGMAO6D7RI2P3USML6URLTKXRCZNW2EA5I26DK5DU6RCRHK";

export const MOCK_FACTORY_CONTRACT_ID =
  "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";
export const MOCK_NFT_CONTRACT_ID =
  "CBNLN62LU545PM2ECR66E7SSUE6G3LOC5NSWH3SVYPS6J225NS72D2JB";
export const MOCK_GOVERNOR_CONTRACT_ID =
  "CBCGFEJRIVHLPFXPUNQJ2LSL4YDBNSZVEHIDVYPIQZR2CRDS5EK64QWL";

export const MOCK_CONTRACT_A =
  "CCLQH4X7W2M2UKFP6VRNP7SNLX5U3ILYQ6JMLNGHWTDNVA3QNEFV4W7A";
export const MOCK_CONTRACT_B =
  "CBDGUNQBQOKS2VNDUUGUAZCPVCXXVZVEMBK35H3DPHT6IG2CQSGV6K7U";
export const MOCK_CONTRACT_OTHER =
  "CD5QU4WUD2EAZZKQ76M4DB5MHMG5KVVWZ7SODNXF4ZLQ737PMLUBBZCN";

export const MOCK_ATLAS_GOVERNOR_ID =
  "CB75DJBIYCVL6ZTPMRTXJE3Z2E73LQ46KEVKTDPWQ4XGWWIYOACVS6RW";
export const MOCK_ATLAS_NFT_ID =
  "CDBQG7HP5TRULYLH7ZYIDHM3WFQRQ7E7FYJ3ZWT2O6QBP3T5PKKSLKQ2";
export const MOCK_BEACON_GOVERNOR_ID =
  "CBOWP2XJPV522TIGSRHW67WZGUWSFTS3UFXW4FEW2V2C3NPVEH65FBXF";
export const MOCK_BEACON_NFT_ID =
  "CBUSNWMYV4J2MM6IC6QJHG7EHC6WRUIF22NED3CQVDA4TODYIVJLWUS4";
export const MOCK_DRIFT_GOVERNOR_ID =
  "CAWTWZ6RRUMM4BNK6HJIMX6EWS4OTNWRGIYCJ7DDLEBKDDN64F6SWG65";
export const MOCK_DRIFT_NFT_ID =
  "CCCCB6YNMREQ6TJSJO52QM5YOE5A7OGXMZEOZ2TX2SEGWJCVO7IE3UJN";

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
