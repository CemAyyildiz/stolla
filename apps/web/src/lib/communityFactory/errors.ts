export type CommunityDeploymentErrorKind =
  | "configuration"
  | "network"
  | "simulation"
  | "wallet_rejection"
  | "wallet"
  | "rpc"
  | "contract"
  | "submission"
  | "unknown";

export class CommunityDeploymentError extends Error {
  constructor(
    public readonly kind: CommunityDeploymentErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CommunityDeploymentError";
  }
}

export function toCommunityDeploymentError(
  error: unknown,
  fallbackKind: CommunityDeploymentErrorKind,
): CommunityDeploymentError {
  if (error instanceof CommunityDeploymentError) return error;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user declined") ||
    lower.includes("rejected by user") ||
    lower.includes("closed the modal") ||
    lower.includes("request rejected")
  ) {
    return new CommunityDeploymentError(
      "wallet_rejection",
      "Wallet authorization was rejected. Your community details are still here.",
      error,
    );
  }

  if (lower.includes("network") && lower.includes("passphrase")) {
    return new CommunityDeploymentError(
      "network",
      "Wallet network does not match the configured Stellar network.",
      error,
    );
  }

  if (lower.includes("simulate") || lower.includes("simulation")) {
    return new CommunityDeploymentError(
      "simulation",
      `Simulation failed: ${message}`,
      error,
    );
  }

  if (lower.includes("host") || lower.includes("rpc") || lower.includes("fetch")) {
    return new CommunityDeploymentError("rpc", `RPC request failed: ${message}`, error);
  }

  if (lower.includes("contract") || lower.includes("error(") || lower.includes("panic")) {
    return new CommunityDeploymentError(
      "contract",
      `CommunityFactory rejected the invocation: ${message}`,
      error,
    );
  }

  return new CommunityDeploymentError(
    fallbackKind,
    message || "Community deployment failed.",
    error,
  );
}
