/**
 * Shared transaction lifecycle stages for mint, delegation, proposal, and vote flows.
 * Individual flows may map specialized terminal outcomes onto `success` / `failure`.
 */
export const TRANSACTION_LIFECYCLE_STAGES = [
  "idle",
  "simulating",
  "awaiting_approval",
  "submitting",
  "confirming",
  "success",
  "failure",
] as const;

export type TransactionLifecycleStage =
  (typeof TRANSACTION_LIFECYCLE_STAGES)[number];

export type TransactionLifecycleMetadata = {
  /** Confirmed or submitted transaction hash when available. */
  transactionHash?: string | null;
  /** Free-form detail lines shown under the status label. */
  details?: Array<{ label: string; value: string }>;
};

const PENDING_STAGES = new Set<TransactionLifecycleStage>([
  "simulating",
  "awaiting_approval",
  "submitting",
  "confirming",
]);

const TERMINAL_STAGES = new Set<TransactionLifecycleStage>([
  "success",
  "failure",
]);

export function isTransactionLifecycleStage(
  value: unknown,
): value is TransactionLifecycleStage {
  return (
    typeof value === "string" &&
    (TRANSACTION_LIFECYCLE_STAGES as readonly string[]).includes(value)
  );
}

/** Normalize unknown / impossible stage values to a safe display stage. */
export function resolveTransactionLifecycleStage(
  stage: unknown,
): TransactionLifecycleStage {
  if (isTransactionLifecycleStage(stage)) return stage;
  return "failure";
}

export function isPendingTransactionLifecycleStage(
  stage: TransactionLifecycleStage,
): boolean {
  return PENDING_STAGES.has(stage);
}

export function isTerminalTransactionLifecycleStage(
  stage: TransactionLifecycleStage,
): boolean {
  return TERMINAL_STAGES.has(stage);
}

export const TRANSACTION_LIFECYCLE_LABELS: Record<
  TransactionLifecycleStage,
  string
> = {
  idle: "Ready",
  simulating: "Simulating transaction…",
  awaiting_approval: "Waiting for wallet approval…",
  submitting: "Submitting to network…",
  confirming: "Confirming on ledger…",
  success: "Transaction confirmed",
  failure: "Transaction failed",
};
