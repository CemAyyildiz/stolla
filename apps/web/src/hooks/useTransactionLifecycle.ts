"use client";

import { useCallback, useState } from "react";

/**
 * Transaction lifecycle stages for vote submission.
 */
export type TransactionStage =
  | "idle"
  | "simulating"
  | "wallet_approval"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "wallet_rejected"
  | "simulation_failed"
  | "submission_failed"
  | "duplicate_vote";

export type TransactionLifecycleState = {
  stage: TransactionStage;
  /** The vote type the user selected (1=For, 0=Against, 2=Abstain) */
  voteType: number | null;
  /** The reason text the user entered */
  reason: string;
  /** Error message if the transaction failed */
  error: string | null;
  /** Whether the transaction is terminal (confirmed or permanently failed) */
  isTerminal: boolean;
};

const TERMINAL_STAGES: TransactionStage[] = [
  "confirmed",
  "wallet_rejected",
  "submission_failed",
  "duplicate_vote",
];

function isTerminalStage(stage: TransactionStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export type VoteTransactionFn = () => Promise<void>;

type UseTransactionLifecycleOptions = {
  /** Called when the transaction completes successfully */
  onConfirmed?: () => void | Promise<void>;
};

/**
 * Manages the full lifecycle of a vote transaction.
 *
 * Tracks stages from simulation through wallet approval, submission,
 * and confirmation. Handles wallet rejections, RPC failures, and
 * duplicate vote errors as distinct terminal states.
 */
export function useTransactionLifecycle(options?: UseTransactionLifecycleOptions) {
  const [state, setState] = useState<TransactionLifecycleState>({
    stage: "idle",
    voteType: null,
    reason: "",
    error: null,
    isTerminal: false,
  });

  const reset = useCallback(() => {
    setState({
      stage: "idle",
      voteType: null,
      reason: "",
      error: null,
      isTerminal: false,
    });
  }, []);

  const execute = useCallback(
    async (voteType: number, reason: string, fn: VoteTransactionFn) => {
      setState({
        stage: "simulating",
        voteType,
        reason,
        error: null,
        isTerminal: false,
      });

      try {
        // Stage: Simulating
        // The SDK client.cast_vote() call simulates the transaction first
        // before signing. If simulation fails, we catch it here.

        // Stage: Wallet approval + submission + confirmation
        // signAndSend() handles wallet approval, network submission,
        // and waiting for ledger confirmation
        setState((prev) => ({
          ...prev,
          stage: "wallet_approval",
        }));

        await fn();

        // Stage: Confirmed
        setState((prev) => ({
          ...prev,
          stage: "confirmed",
          isTerminal: true,
        }));

        // Notify caller
        await options?.onConfirmed?.();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error ?? "Unknown error");

        // Detect wallet rejection (user cancelled the signing prompt)
        if (
          message.toLowerCase().includes("user rejected") ||
          message.toLowerCase().includes("user declined") ||
          message.toLowerCase().includes("denied") ||
          message.toLowerCase().includes("rejected") ||
          message.toLowerCase().includes("cancel")
        ) {
          setState((prev) => ({
            ...prev,
            stage: "wallet_rejected",
            error: message,
            isTerminal: true,
          }));
          return;
        }

        // Detect duplicate vote (AlreadyVoted error from contract)
        if (
          message.includes("AlreadyVoted") ||
          message.includes("already voted") ||
          message.includes("5016")
        ) {
          setState((prev) => ({
            ...prev,
            stage: "duplicate_vote",
            error: "You have already voted on this proposal.",
            isTerminal: true,
          }));
          return;
        }

        // Detect simulation failure
        if (
          message.toLowerCase().includes("simulation") ||
          message.toLowerCase().includes("simulate")
        ) {
          setState((prev) => ({
            ...prev,
            stage: "simulation_failed",
            error: message,
            isTerminal: true,
          }));
          return;
        }

        // Generic submission failure — preserve the reason for retry
        setState((prev) => ({
          ...prev,
          stage: "submission_failed",
          error: message,
          isTerminal: true,
        }));
      }
    },
    [options],
  );

  return {
    state,
    execute,
    reset,
  };
}
