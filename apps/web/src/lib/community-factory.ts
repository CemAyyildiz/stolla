import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import type { CommunityDraft, CommunitySimulation } from "./community-creation";
import { NetworkMismatchError, type StellarNetwork } from "./network";

const CREATE_COMMUNITY_FUNCTION = "create_community";
const TRANSACTION_TIMEOUT_SECONDS = 60;

export class FactoryNotConfiguredError extends Error {
  constructor() {
    super(
      "CommunityFactory address is not configured. Set NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID.",
    );
    this.name = "FactoryNotConfiguredError";
  }
}

export type SimulateDeploymentParams = {
  network: StellarNetwork;
  rpcUrl: string;
  factoryAddress: string;
  admin: string;
  draft: CommunityDraft;
};

function toArguments(admin: string, draft: CommunityDraft) {
  return [
    new Address(admin).toScVal(),
    nativeToScVal(draft.name.trim(), { type: "string" }),
    nativeToScVal(draft.symbol.trim(), { type: "string" }),
    nativeToScVal(draft.metadataUri.trim(), { type: "string" }),
    nativeToScVal(Number(draft.votingDelay), { type: "u32" }),
    nativeToScVal(Number(draft.votingPeriod), { type: "u32" }),
    nativeToScVal(BigInt(draft.proposalThreshold), { type: "i128" }),
    nativeToScVal(BigInt(draft.quorum), { type: "i128" }),
  ];
}

export async function simulateCommunityDeployment({
  network,
  rpcUrl,
  factoryAddress,
  admin,
  draft,
}: SimulateDeploymentParams): Promise<CommunitySimulation> {
  if (!factoryAddress) throw new FactoryNotConfiguredError();

  const server = new rpc.Server(rpcUrl);
  const source = await server.getAccount(admin);
  const operation = new Contract(factoryAddress).call(
    CREATE_COMMUNITY_FUNCTION,
    ...toArguments(admin, draft),
  );

  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(operation)
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  return {
    networkPassphrase: network.passphrase,
    factoryAddress,
    transactionXdr: rpc
      .assembleTransaction(transaction, simulation)
      .build()
      .toXDR(),
    minResourceFee: simulation.minResourceFee,
  };
}

export type SubmitDeploymentParams = {
  simulation: CommunitySimulation;
  network: StellarNetwork;
  rpcUrl: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
};

export async function submitCommunityDeployment({
  simulation,
  network,
  rpcUrl,
  signTransaction,
}: SubmitDeploymentParams): Promise<string> {
  /**
   * The simulation carries the network it was built on. Refusing to parse it
   * under any other passphrase keeps a transaction from a previous network out
   * of the signing path entirely.
   */
  if (simulation.networkPassphrase !== network.passphrase) {
    throw new NetworkMismatchError(network, null);
  }

  const { signedTxXdr } = await signTransaction(simulation.transactionXdr);
  const signed = TransactionBuilder.fromXDR(signedTxXdr, network.passphrase);
  const response = await new rpc.Server(rpcUrl).sendTransaction(signed);

  if (response.status === "ERROR" || response.status === "DUPLICATE") {
    throw new Error(`Submission failed with status ${response.status}.`);
  }
  return response.hash;
}
