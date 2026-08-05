/**
 * Typed frontend taxonomy for transaction failures.
 */
export const TRANSACTION_ERROR_CATEGORIES = [
  "wallet_rejected",
  "wallet_unavailable",
  "simulation_failed",
  "rpc_unavailable",
  "send_failed",
  "confirmation_timeout",
  "still_pending",
  "contract_error",
  "unknown",
] as const;

export type TransactionErrorCategory =
  (typeof TRANSACTION_ERROR_CATEGORIES)[number];

export type MappedTransactionError = {
  category: TransactionErrorCategory;
  /** Concise user-facing message. */
  message: string;
  /** Whether the user should retry the same action. */
  retryable: boolean;
  /** Technical detail for diagnostics (never render directly). */
  diagnostic: string | null;
};

const USER_MESSAGES: Record<
  TransactionErrorCategory,
  { message: string; retryable: boolean }
> = {
  wallet_rejected: {
    message:
      "You rejected the wallet request. Approve the next prompt to continue.",
    retryable: true,
  },
  wallet_unavailable: {
    message:
      "No wallet is available. Connect or unlock your Stellar wallet, then try again.",
    retryable: true,
  },
  simulation_failed: {
    message:
      "The transaction could not be simulated. Check your inputs and account state, then retry.",
    retryable: true,
  },
  rpc_unavailable: {
    message:
      "The Stellar network is temporarily unreachable. Wait a moment and try again.",
    retryable: true,
  },
  send_failed: {
    message:
      "The transaction could not be submitted. Check your connection and retry.",
    retryable: true,
  },
  confirmation_timeout: {
    message:
      "Confirmation timed out. The transaction may still be pending—check an explorer before retrying.",
    retryable: false,
  },
  still_pending: {
    message:
      "The transaction is still pending on the network. Check your wallet or explorer before submitting again.",
    retryable: false,
  },
  contract_error: {
    message:
      "The contract rejected this operation. Review the requirements and try a different action.",
    retryable: false,
  },
  unknown: {
    message:
      "Something went wrong while processing the transaction. Please try again.",
    retryable: true,
  },
};

function asDiagnostic(error: unknown): string | null {
  if (error instanceof Error) {
    const text = error.message?.trim();
    return text ? text.slice(0, 500) : error.name || null;
  }
  if (typeof error === "string") {
    const text = error.trim();
    return text ? text.slice(0, 500) : null;
  }
  return null;
}

function lowerText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }
  if (typeof error === "string") return error.toLowerCase();
  return "";
}

function classify(error: unknown): TransactionErrorCategory {
  const text = lowerText(error);

  if (
    text.includes("user rejected") ||
    text.includes("user declined") ||
    text.includes("rejected the request") ||
    text.includes("user cancelled") ||
    text.includes("user canceled") ||
    (text.includes("denied") && text.includes("user"))
  ) {
    return "wallet_rejected";
  }

  if (
    text.includes("no wallet") ||
    text.includes("wallet not found") ||
    text.includes("wallet unavailable") ||
    text.includes("wallet is not connected") ||
    (text.includes("freighter") && text.includes("not installed"))
  ) {
    return "wallet_unavailable";
  }

  if (
    text.includes("still pending") ||
    text.includes("transactionstillpending") ||
    (text.includes("pending") && text.includes("waited"))
  ) {
    return "still_pending";
  }

  if (
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("confirmation timeout")
  ) {
    return "confirmation_timeout";
  }

  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    (text.includes("rpc") &&
      (text.includes("unavailable") || text.includes("unreachable")))
  ) {
    return "rpc_unavailable";
  }

  if (text.includes("simulation") || text.includes("simulate")) {
    return "simulation_failed";
  }

  if (
    text.includes("alreadyvoted") ||
    text.includes("already voted") ||
    text.includes("#5016") ||
    text.includes("error 5016") ||
    text.includes("hosterror") ||
    text.includes("traphost") ||
    (text.includes("contract") && text.includes("error")) ||
    text.includes("insufficient")
  ) {
    return "contract_error";
  }

  if (
    text.includes("send failed") ||
    text.includes("sendtransaction") ||
    text.includes("submission failed") ||
    text.includes("failed to send")
  ) {
    return "send_failed";
  }

  if (
    text.includes("rejected") ||
    text.includes("cancelled") ||
    text.includes("canceled")
  ) {
    return "wallet_rejected";
  }

  return "unknown";
}

/**
 * Map an unknown transaction failure into a safe, actionable user message.
 */
export function mapTransactionError(error: unknown): MappedTransactionError {
  const category = classify(error);
  const copy = USER_MESSAGES[category];
  return {
    category,
    message: copy.message,
    retryable: copy.retryable,
    diagnostic: asDiagnostic(error),
  };
}
