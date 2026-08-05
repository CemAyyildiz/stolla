import {
  isPendingTransactionLifecycleStage,
  type TransactionLifecycleStage,
} from "@/lib/transactionLifecycle";

export type LifecycleAssembledTransaction = {
  sign?: () => Promise<unknown>;
  send?: () => Promise<unknown>;
  signAndSend?: () => Promise<unknown>;
};

export type RunTransactionLifecycleOptions = {
  assemble: () => Promise<LifecycleAssembledTransaction>;
  onStage: (stage: TransactionLifecycleStage) => void;
};

function isWalletRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user declined") ||
    lower.includes("denied") ||
    lower.includes("rejected") ||
    lower.includes("cancel")
  );
}

function isStillPending(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("still pending") ||
    lower.includes("not yet") ||
    lower.includes("pending")
  );
}

export type TransactionLifecycleOutcome =
  | { ok: true }
  | {
      ok: false;
      kind: "wallet_rejected" | "send_failed" | "still_pending" | "simulation_failed";
      message: string;
    };

/**
 * Runs assemble → approve → submit → confirm stage transitions for a signed
 * Soroban transaction, using `sign`/`send` when available.
 */
export async function runTransactionLifecycle({
  assemble,
  onStage,
}: RunTransactionLifecycleOptions): Promise<TransactionLifecycleOutcome> {
  try {
    onStage("simulating");
    const tx = await assemble();

    onStage("awaiting_approval");

    if (typeof tx.sign === "function" && typeof tx.send === "function") {
      await tx.sign();
      onStage("submitting");
      onStage("confirming");
      await tx.send();
    } else if (typeof tx.signAndSend === "function") {
      const pending = tx.signAndSend();
      onStage("submitting");
      onStage("confirming");
      await pending;
    } else {
      throw new Error("Transaction cannot be signed or sent.");
    }

    onStage("success");
    return { ok: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");

    if (isWalletRejection(message)) {
      onStage("failure");
      return { ok: false, kind: "wallet_rejected", message };
    }

    if (isStillPending(message)) {
      onStage("failure");
      return {
        ok: false,
        kind: "still_pending",
        message:
          "Transaction is still pending on the network. Check your wallet or explorer and try again later.",
      };
    }

    // Failures before approval are treated as simulation/build errors.
    if (
      message.toLowerCase().includes("simulation") ||
      message.toLowerCase().includes("simulate")
    ) {
      onStage("failure");
      return { ok: false, kind: "simulation_failed", message };
    }

    onStage("failure");
    return { ok: false, kind: "send_failed", message };
  }
}

export function isLifecycleInFlight(
  stage: TransactionLifecycleStage,
): boolean {
  return isPendingTransactionLifecycleStage(stage);
}
