export type StellarNetworkId = "testnet" | "mainnet";

const TX_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * Build a Stellar Expert explorer URL for a confirmed transaction hash.
 * Returns null when the hash is missing or invalid so callers can skip the link.
 */
export function buildStellarExplorerTxUrl(
  hash: string | null | undefined,
  network: StellarNetworkId = "testnet",
): string | null {
  if (!hash || !TX_HASH_PATTERN.test(hash.trim())) {
    return null;
  }

  const normalized = hash.trim().toLowerCase();
  const explorerNetwork = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${normalized}`;
}

/** Resolve the app's configured network into a helper-friendly id. */
export function resolveStellarNetworkId(
  raw: string | undefined = process.env.NEXT_PUBLIC_STELLAR_NETWORK,
): StellarNetworkId {
  return raw === "mainnet" ? "mainnet" : "testnet";
}
