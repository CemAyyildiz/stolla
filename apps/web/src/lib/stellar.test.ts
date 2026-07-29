import { afterEach, describe, expect, it, vi } from "vitest";
import { Networks } from "@stellar/stellar-sdk";

async function loadConfig(network?: string) {
  vi.resetModules();
  if (network) vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", network);
  return import("./stellar");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("active network", () => {
  it("defaults to testnet", async () => {
    const { activeNetwork, config } = await loadConfig();
    expect(activeNetwork.id).toBe("testnet");
    expect(config.passphrase).toBe(Networks.TESTNET);
  });

  it("follows NEXT_PUBLIC_STELLAR_NETWORK when set to mainnet", async () => {
    const { activeNetwork, config } = await loadConfig("mainnet");
    expect(activeNetwork.id).toBe("mainnet");
    expect(config.passphrase).toBe(Networks.PUBLIC);
    expect(config.explorerSegment).toBe("public");
  });

  it("keeps the passphrase and explorer segment in step", async () => {
    const { activeNetwork, config } = await loadConfig("mainnet");
    expect(activeNetwork).toMatchObject({
      passphrase: config.passphrase,
      explorerSegment: config.explorerSegment,
    });
  });
});
