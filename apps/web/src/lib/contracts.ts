import { Client as NftClient } from "@/lib/bindings/community-nft/src";
import { Client as GovernorClient } from "@/lib/bindings/community-governor/src";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { config, requireContractIds } from "./stellar";

type ClientOptions = {
  publicKey: string;
  signTransaction: SignTransaction;
  contractId?: string;
};

export function createNftClient({
  publicKey,
  signTransaction,
  contractId,
}: ClientOptions) {
  const nft = contractId ?? requireContractIds().nft;
  return new NftClient({
    contractId: nft,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createGovernorClient({
  publicKey,
  signTransaction,
  contractId,
}: ClientOptions) {
  const governor = contractId ?? requireContractIds().governor;
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey,
    signTransaction,
  });
}

export function createReadOnlyNftClient(contractId?: string) {
  const nft = contractId ?? requireContractIds().nft;
  return new NftClient({
    contractId: nft,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

export function createReadOnlyGovernorClient(contractId?: string) {
  const governor = contractId ?? requireContractIds().governor;
  return new GovernorClient({
    contractId: governor,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

const PROPOSAL_STORAGE_KEY = "stolla:proposal-ids";

export function getStoredProposalIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROPOSAL_STORAGE_KEY);
  if (!raw) return [];
  const proposalIds: unknown = JSON.parse(raw);
  if (
    !Array.isArray(proposalIds) ||
    !proposalIds.every((proposalId) => typeof proposalId === "string")
  ) {
    throw new Error("Stored proposal history is invalid.");
  }
  return proposalIds;
}

export function storeProposalId(idHex: string) {
  const existing = getStoredProposalIds();
  if (!existing.includes(idHex)) {
    localStorage.setItem(
      PROPOSAL_STORAGE_KEY,
      JSON.stringify([idHex, ...existing]),
    );
  }
}
