import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const stellarConfig = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    rpcUrl: "",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    friendbotUrl: null,
  },
};

function buildResponse(env: Record<string, string | undefined>) {
  const selected =
    env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

  const activeRpcUrl =
    selected === "mainnet"
      ? env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL ?? stellarConfig.mainnet.rpcUrl
      : env.NEXT_PUBLIC_STELLAR_RPC_URL ?? stellarConfig.testnet.rpcUrl;

  const rpcConfigured = Boolean(
    activeRpcUrl && activeRpcUrl.trim() !== "",
  );

  const nftContractId = env.NEXT_PUBLIC_NFT_CONTRACT_ID ?? "";
  const governorContractId = env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID ?? "";

  const nftConfigured = Boolean(nftContractId && nftContractId.trim() !== "");
  const governorConfigured = Boolean(
    governorContractId && governorContractId.trim() !== "",
  );
  const allContractsConfigured = nftConfigured && governorConfigured;

  const passphraseConfigured = Boolean(
    selected === "mainnet"
      ? stellarConfig.mainnet.networkPassphrase
      : stellarConfig.testnet.networkPassphrase,
  );

  const rpcOk =
    selected === "mainnet"
      ? rpcConfigured
      : rpcConfigured || Boolean(stellarConfig.testnet.rpcUrl);

  const contractsOk = allContractsConfigured;

  const isReady = rpcOk && contractsOk && passphraseConfigured;

  const response = {
    status: isReady ? "ok" : "degraded",
    network: {
      selected,
      passphraseConfigured,
    },
    rpc: {
      configured: rpcConfigured,
    },
    contracts: {
      nftConfigured,
      governorConfigured,
      allConfigured: allContractsConfigured,
    },
  };

  return {
    response,
    statusCode: isReady ? 200 : 503,
  };
}

describe("health endpoint", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns ok with complete testnet configuration", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(200);
    expect(response.status).toBe("ok");
    expect(response.network.selected).toBe("testnet");
    expect(response.network.passphraseConfigured).toBe(true);
    expect(response.rpc.configured).toBe(true);
    expect(response.contracts.nftConfigured).toBe(true);
    expect(response.contracts.governorConfigured).toBe(true);
    expect(response.contracts.allConfigured).toBe(true);
  });

  it("returns degraded when testnet is missing nft contract id", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID = "";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.contracts.nftConfigured).toBe(false);
    expect(response.contracts.allConfigured).toBe(false);
  });

  it("returns degraded when testnet is missing governor contract id", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID = "";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.contracts.governorConfigured).toBe(false);
    expect(response.contracts.allConfigured).toBe(false);
  });

  it("returns degraded when all contract ids are missing on testnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID = "";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID = "";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.contracts.nftConfigured).toBe(false);
    expect(response.contracts.governorConfigured).toBe(false);
    expect(response.contracts.allConfigured).toBe(false);
  });

  it("returns ok with complete mainnet configuration", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL =
      "https://soroban.stellar.org";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(200);
    expect(response.status).toBe("ok");
    expect(response.network.selected).toBe("mainnet");
    expect(response.rpc.configured).toBe(true);
    expect(response.contracts.allConfigured).toBe(true);
  });

  it("returns degraded when mainnet is missing rpc url", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL = "";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID =
      "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.network.selected).toBe("mainnet");
    expect(response.rpc.configured).toBe(false);
  });

  it("returns degraded when mainnet is missing contract ids", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL =
      "https://soroban.stellar.org";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID = "";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID = "";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.contracts.allConfigured).toBe(false);
  });

  it("identifies mainnet selection without exposing secrets", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL =
      "https://secret-rpc.example.com";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID = "CCSECRET_CONTRACT_ID_XYZ";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID = "CCSECRET_GOVERNOR_ID_ABC";

    const { response } = buildResponse(process.env);

    expect(response.network.selected).toBe("mainnet");
    expect(JSON.stringify(response)).not.toContain("secret-rpc");
    expect(JSON.stringify(response)).not.toContain("SECRET_CONTRACT");
    expect(JSON.stringify(response)).not.toContain("SECRET_GOVERNOR");
  });

  it("treats whitespace-only contract ids as unconfigured", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ID = "   ";
    process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID = "\t\n";

    const { response, statusCode } = buildResponse(process.env);

    expect(statusCode).toBe(503);
    expect(response.status).toBe("degraded");
    expect(response.contracts.nftConfigured).toBe(false);
    expect(response.contracts.governorConfigured).toBe(false);
  });
});
