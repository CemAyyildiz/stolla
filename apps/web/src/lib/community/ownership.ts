import { StrKey, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { AssembledTransaction, type SignTransaction } from "@stellar/stellar-sdk/contract";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { createNftClient, createReadOnlyNftClient } from "@/lib/contracts";
import { requireCommunityFactoryId, requireRpcConfig } from "@/lib/stellar";

export function validateNewOwner(value: string, currentOwner: string): string | null {
  if (!StrKey.isValidEd25519PublicKey(value)) {
    return "Enter a valid Stellar G address with its full checksum.";
  }
  if (value === currentOwner) return "Enter an address different from the current owner.";
  return null;
}

export type OwnershipSimulation = {
  destination: string;
  deadline: number;
  transaction: AssembledTransaction<null>;
};

export const communityOwnership = {
  async readOwner(nftContract: string): Promise<string | null> {
    const response = await createReadOnlyNftClient(nftContract).get_owner();
    return response.result ?? null;
  },

  async simulate(nftContract: string, owner: string, destination: string, signTransaction: SignTransaction): Promise<OwnershipSimulation> {
    const error = validateNewOwner(destination, owner);
    if (error) throw new Error(error);
    const currentOwner = await this.readOwner(nftContract);
    if (currentOwner !== owner) throw new Error("This wallet is no longer the NFT owner. Refresh the page.");
    const rpc = requireRpcConfig();
    const latest = await new RpcServer(rpc.rpcUrl).getLatestLedger();
    const deadline = latest.sequence + 17_280; // About one day for the recipient to accept.
    const transaction = await createNftClient({ publicKey: owner, signTransaction, contractId: nftContract })
      .transfer_ownership({ new_owner: destination, live_until_ledger: deadline });
    return { destination, deadline, transaction };
  },

  async begin(simulation: OwnershipSimulation): Promise<void> {
    await simulation.transaction.signAndSend();
  },

  async accept(nftContract: string, recipient: string, signTransaction: SignTransaction): Promise<void> {
    const transaction = await createNftClient({ publicKey: recipient, signTransaction, contractId: nftContract })
      .accept_ownership();
    await transaction.signAndSend();
  },

  async syncRegistry(communityId: string, publicKey: string, signTransaction: SignTransaction): Promise<void> {
    const rpc = requireRpcConfig();
    const transaction = await AssembledTransaction.build({
      contractId: requireCommunityFactoryId(),
      method: "sync_community_owner",
      args: [nativeToScVal(Uint8Array.from(communityId.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16))))],
      networkPassphrase: rpc.networkPassphrase,
      rpcUrl: rpc.rpcUrl,
      publicKey,
      parseResultXdr: scValToNative,
    });
    await transaction.signAndSend({ signTransaction });
  },
};
