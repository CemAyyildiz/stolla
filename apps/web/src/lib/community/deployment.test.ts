import { Networks, scValToNative } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  formatStroopsAsXlm,
  isExpiredOrStaleDeploymentError,
  parseCommunityDeploymentRecovery,
  serializeCommunityFactoryInvocation,
} from "./deployment";

const creator = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const factoryId = `C${"A".repeat(55)}`;
const input = {
  creator,
  communityOwner: creator,
  factoryId,
  network: "testnet" as const,
  networkPassphrase: Networks.TESTNET,
  metadata: {
    name: "Builders Guild",
    symbol: "BUILD",
    description: "Build public goods.",
    collectionUri: "ipfs://collection",
    metadataUri: "https://example.test/community.json",
    logo: "",
    externalLinkLabel: "",
    externalLinkUrl: "",
  },
  governance: {
    proposalThreshold: "340282366920938463463374607431768211455",
    quorum: "9007199254740993",
    votingDelay: "12",
    votingPeriod: "17280",
  },
};

describe("community deployment serialization", () => {
  it("serializes the exact CommunityFactory method, source, network, and lossless values", async () => {
    const hash = Uint8Array.from({ length: 32 }, (_, index) => index);
    const invocation = await serializeCommunityFactoryInvocation(input, hash);
    const request = scValToNative(invocation.args[1]) as Record<string, unknown>;
    const governance = request.governance as Record<string, unknown>;
    const metadata = request.metadata as Record<string, unknown>;

    expect(invocation).toMatchObject({
      contractId: factoryId,
      method: "create_community",
      sourceAccount: creator,
      networkPassphrase: Networks.TESTNET,
      metadataHash:
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    });
    expect(scValToNative(invocation.args[0])).toBe(creator);
    expect(request.community_owner).toBe(creator);
    expect(governance.proposal_threshold).toBe(
      BigInt("340282366920938463463374607431768211455"),
    );
    expect(governance.quorum).toBe(BigInt("9007199254740993"));
    expect(governance.voting_delay).toBe(12);
    expect(Array.from(metadata.metadata_hash as Uint8Array)).toEqual(
      Array.from(hash),
    );
  });

  it("fails closed on a mismatched network passphrase before simulation", async () => {
    await expect(
      serializeCommunityFactoryInvocation(
        { ...input, networkPassphrase: Networks.PUBLIC },
        new Uint8Array(32),
      ),
    ).rejects.toThrow(/does not match the application network/);
  });

  it("converts stroops with exact integer arithmetic, including huge values", () => {
    expect(formatStroopsAsXlm("12345678")).toBe("1.2345678 XLM");
    expect(formatStroopsAsXlm("10000000")).toBe("1 XLM");
    expect(formatStroopsAsXlm("900719925474099312345678")).toBe(
      "90071992547409931.2345678 XLM",
    );
  });

  it("recognizes expiry and stale sequence failures without treating arbitrary errors as rebuildable", () => {
    expect(isExpiredOrStaleDeploymentError(new Error("tx_too_late"))).toBe(true);
    expect(isExpiredOrStaleDeploymentError(new Error("tx_bad_seq"))).toBe(true);
    expect(isExpiredOrStaleDeploymentError(new Error("wallet rejected"))).toBe(
      false,
    );
  });

  it("restores only network-scoped valid submitted transaction recovery", () => {
    const raw = JSON.stringify({
      version: 1,
      network: "testnet",
      transactionHash: "ab".repeat(32),
      submittedAt: 123,
      expectedRecord: {
        id: "cd".repeat(32),
        nftContract: `C${"B".repeat(55)}`,
        governorContract: `C${"C".repeat(55)}`,
        creator,
        communityOwner: creator,
        createdAtLedger: 10,
        creationIndex: 2,
        metadataUri: "https://example.test/community.json",
        metadataHash: "ef".repeat(32),
        metadataSchemaVersion: 1,
      },
    });
    expect(parseCommunityDeploymentRecovery(raw, "testnet")).toMatchObject({
      transactionHash: "ab".repeat(32),
    });
    expect(parseCommunityDeploymentRecovery(raw, "mainnet")).toBeNull();
    expect(
      parseCommunityDeploymentRecovery(
        raw.replace("ab".repeat(32), "invalid"),
        "testnet",
      ),
    ).toBeNull();
  });
});
