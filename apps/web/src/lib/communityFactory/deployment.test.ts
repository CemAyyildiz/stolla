import { describe, expect, it } from "vitest";
import { createCommunityDeploymentFixture } from "@/test-support/stellar";
import {
  deployCommunityFromWizard,
  extractTransactionHash,
} from "./deployment";
import type { CommunityWizardState } from "./types";

const state: CommunityWizardState = {
  metadata: {
    name: "Stolla Labs",
    symbol: "STLA",
    baseUri: "ipfs://QmCommunity",
    description: "A testnet community",
    externalUrl: "",
  },
  governance: {
    votingDelay: "1",
    votingPeriod: "17280",
    proposalThreshold: "1",
    quorum: "1",
  },
};

describe("deployCommunityFromWizard", () => {
  it("fails before simulation on network mismatch", async () => {
    const fixture = createCommunityDeploymentFixture({
      walletNetworkPassphrase:
        "Public Global Stellar Network ; September 2015",
    });

    await expect(
      deployCommunityFromWizard(state, fixture.dependencies),
    ).rejects.toMatchObject({ kind: "network" });
    expect(fixture.deployCommunity.callCount()).toBe(0);
  });

  it("surfaces simulation failures before wallet signing", async () => {
    const fixture = createCommunityDeploymentFixture({
      simulationError: new Error("simulation rejected contract args"),
    });

    await expect(
      deployCommunityFromWizard(state, fixture.dependencies),
    ).rejects.toMatchObject({ kind: "simulation" });
    expect(fixture.stages).toEqual(["serializing", "simulating"]);
    expect(fixture.signAndSend.callCount()).toBe(0);
  });

  it("does not store a hash when the wallet rejects authorization", async () => {
    const fixture = createCommunityDeploymentFixture({
      submissionError: new Error("User rejected request"),
    });

    await expect(
      deployCommunityFromWizard(state, fixture.dependencies),
    ).rejects.toMatchObject({ kind: "wallet_rejection" });
    expect(fixture.hashes).toEqual([]);
  });

  it("fails submission when the wallet response has no hash", async () => {
    const fixture = createCommunityDeploymentFixture({ response: {} });

    await expect(
      deployCommunityFromWizard(state, fixture.dependencies),
    ).rejects.toMatchObject({ kind: "submission" });
  });

  it("stores the transaction hash immediately after successful submission", async () => {
    const fixture = createCommunityDeploymentFixture({
      response: {
        txHash: "hash-from-wallet",
        result: {
          nft_contract: "CNFT",
          governor_contract: "CGOV",
        },
      },
    });

    const outcome = await deployCommunityFromWizard(
      state,
      fixture.dependencies,
    );

    expect(outcome.hash).toBe("hash-from-wallet");
    expect(fixture.hashes).toEqual(["hash-from-wallet"]);
    expect(fixture.stages).toEqual([
      "serializing",
      "simulating",
      "awaiting_wallet",
      "submitting",
      "success",
    ]);
  });
});

describe("extractTransactionHash", () => {
  it("accepts common wallet hash field names", () => {
    expect(extractTransactionHash({ hash: "a" })).toBe("a");
    expect(extractTransactionHash({ txHash: "b" })).toBe("b");
    expect(extractTransactionHash({ transactionHash: "c" })).toBe("c");
    expect(extractTransactionHash({ id: "d" })).toBe("d");
  });
});
