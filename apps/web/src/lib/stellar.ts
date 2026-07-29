import { NETWORKS, type StellarNetwork } from "./network";

export type NetworkConfig = StellarNetwork & {
  rpcUrl: string;
  horizonUrl: string;
  friendbotUrl: string | null;
};

export const stellarConfig = {
  testnet: {
    ...NETWORKS.testnet,
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    ...NETWORKS.mainnet,
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL ?? "",
    horizonUrl: "https://horizon.stellar.org",
    friendbotUrl: null,
  },
} satisfies Record<string, NetworkConfig>;

const selected = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

export const config: NetworkConfig =
  selected === "mainnet" ? stellarConfig.mainnet : stellarConfig.testnet;

/** The network every simulation, signature, submission and explorer link must use. */
export const activeNetwork: StellarNetwork = NETWORKS[config.id];

export const contractIds = {
  nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_ID ?? "",
  governor: process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID ?? "",
  factory: process.env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID ?? "",
};

export function requireContractIds(): { nft: string; governor: string } {
  if (!contractIds.nft || !contractIds.governor) {
    throw new Error(
      "Contract IDs are not configured. Set NEXT_PUBLIC_NFT_CONTRACT_ID and NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }
  return { nft: contractIds.nft, governor: contractIds.governor };
}
