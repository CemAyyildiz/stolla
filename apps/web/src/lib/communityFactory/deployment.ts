import type {
  CommunityDeploymentResult,
  CommunityFactoryCreateArgs,
  CommunityWizardState,
} from "./types";
import { serializeCommunityFactoryArgs } from "./types";
import { CommunityDeploymentError, toCommunityDeploymentError } from "./errors";

export type DeploymentStage =
  | "idle"
  | "serializing"
  | "simulating"
  | "awaiting_wallet"
  | "submitting"
  | "success"
  | "error";

export type SignAndSendResult<T> = {
  result?: T;
  hash?: string;
  txHash?: string;
  transactionHash?: string;
  id?: string;
  status?: string;
};

export type CommunityDeploymentTransaction = {
  signAndSend: () => Promise<SignAndSendResult<CommunityDeploymentResult>>;
};

export type CommunityDeploymentClient = {
  deploy_community: (
    args: CommunityFactoryCreateArgs,
  ) => Promise<CommunityDeploymentTransaction>;
};

export type DeployCommunityDependencies = {
  address: string | null;
  expectedNetworkPassphrase: string;
  walletNetworkPassphrase?: string | null;
  createClient: () => CommunityDeploymentClient;
  storeHash: (hash: string) => void;
  onStage?: (stage: DeploymentStage) => void;
};

export type DeployCommunityOutcome = {
  hash: string;
  result?: CommunityDeploymentResult;
};

export async function deployCommunityFromWizard(
  state: CommunityWizardState,
  dependencies: DeployCommunityDependencies,
): Promise<DeployCommunityOutcome> {
  const { address, expectedNetworkPassphrase, walletNetworkPassphrase } = dependencies;

  if (!address) {
    throw new CommunityDeploymentError("wallet", "Connect your wallet first.");
  }

  if (
    walletNetworkPassphrase &&
    walletNetworkPassphrase !== expectedNetworkPassphrase
  ) {
    throw new CommunityDeploymentError(
      "network",
      "Wallet network does not match the configured Stellar network.",
    );
  }

  dependencies.onStage?.("serializing");
  const args = serializeCommunityFactoryArgs(state, address);

  let assembled: CommunityDeploymentTransaction;
  try {
    dependencies.onStage?.("simulating");
    assembled = await dependencies.createClient().deploy_community(args);
  } catch (error) {
    throw toCommunityDeploymentError(error, "simulation");
  }

  let response: SignAndSendResult<CommunityDeploymentResult>;
  try {
    dependencies.onStage?.("awaiting_wallet");
    response = await assembled.signAndSend();
  } catch (error) {
    throw toCommunityDeploymentError(error, "wallet");
  }

  const hash = extractTransactionHash(response);
  if (!hash) {
    throw new CommunityDeploymentError(
      "submission",
      "Transaction submitted but no transaction hash was returned.",
      response,
    );
  }

  dependencies.onStage?.("submitting");
  dependencies.storeHash(hash);
  dependencies.onStage?.("success");

  return {
    hash,
    result: response.result,
  };
}

export function extractTransactionHash<T>(
  response: SignAndSendResult<T> | undefined,
): string | null {
  if (!response) return null;
  return (
    response.hash ??
    response.txHash ??
    response.transactionHash ??
    response.id ??
    null
  );
}
