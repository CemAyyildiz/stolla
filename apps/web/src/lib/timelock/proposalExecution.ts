import { ProposalState } from "@/lib/bindings/community-governor/src";
import {
  formatLedgerDuration,
  LEDGER_TIME_ASSUMPTION_NOTE,
} from "@/lib/community/governanceDisplay";
import { formatProposalDeadlineEstimate } from "@/lib/proposalDeadline";

/**
 * ADR-006 display constants. The ledger count is authoritative; the
 * approximate duration is only explanatory until a queue record exists.
 */
export const TIMELOCK_MIN_DELAY_LEDGERS = 34_560;
export const TIMELOCK_GRACE_LEDGERS = 120_960;

export const SIGNALING_ONLY_MESSAGE =
  "This proposal is signaling-only. Timelock is not configured, so queue and execute are unavailable.";

export type TimelockActionName = "queue" | "execute" | "cancel";

export type ProposalExecutionPhase =
  | "idle"
  | "signaling"
  | "needs_queue"
  | "waiting"
  | "executable"
  | "expired"
  | "executed"
  | "cancel_only";

export type ProposalExecutionInput = {
  state: ProposalState;
  timelockConfigured: boolean;
  etaLedger: number | null;
  expiresAtLedger: number | null;
  currentLedger: number | null;
  isProposer: boolean;
  walletConnected: boolean;
  correctNetwork: boolean;
};

export type GatedAction = {
  visible: boolean;
  disabled: boolean;
  reason: string | null;
};

export type ProposalExecutionView = {
  phase: ProposalExecutionPhase;
  statusMessage: string | null;
  assumptionNote: string | null;
  delayPreview: string | null;
  earliestExecution: string | null;
  expiry: string | null;
  queue: GatedAction;
  execute: GatedAction;
  cancel: GatedAction;
};

const HIDDEN: GatedAction = { visible: false, disabled: true, reason: null };

const PROPOSER_CANCEL_STATES = new Set<ProposalState>([
  ProposalState.Pending,
  ProposalState.Active,
  ProposalState.Succeeded,
]);

function isLedger(value: number | null): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function formatLedgerMoment(
  ledger: number,
  currentLedger: number | null,
): string {
  const estimate = formatProposalDeadlineEstimate(ledger, currentLedger, null);
  return estimate ? `Ledger ${ledger} (${estimate})` : `Ledger ${ledger}`;
}

function gate(connected: boolean, correctNetwork: boolean, blocked: string | null): GatedAction {
  if (blocked) return { visible: true, disabled: true, reason: blocked };
  if (!connected) {
    return { visible: true, disabled: true, reason: "Connect a wallet to continue." };
  }
  if (!correctNetwork) {
    return {
      visible: true,
      disabled: true,
      reason: "Switch to the application network to continue.",
    };
  }
  return { visible: true, disabled: false, reason: null };
}

function windowCopy(input: ProposalExecutionInput): {
  phase: "waiting" | "executable" | "expired";
  reason: string | null;
  earliest: string | null;
  expiry: string | null;
} {
  const { etaLedger, expiresAtLedger, currentLedger } = input;
  if (!isLedger(etaLedger) || !isLedger(expiresAtLedger)) {
    return {
      phase: "waiting",
      reason: "Execution is disabled until the timelock window is known.",
      earliest: null,
      expiry: null,
    };
  }

  const earliest = formatLedgerMoment(etaLedger, currentLedger);
  const expiry = formatLedgerMoment(expiresAtLedger, currentLedger);

  if (!isLedger(currentLedger)) {
    return {
      phase: "waiting",
      reason: "Execution is disabled until the current ledger is known.",
      earliest,
      expiry,
    };
  }
  if (currentLedger < etaLedger) {
    return {
      phase: "waiting",
      reason: `Execution is disabled until ledger ${etaLedger}.`,
      earliest,
      expiry,
    };
  }
  if (currentLedger > expiresAtLedger) {
    return {
      phase: "expired",
      reason: `Execution is disabled because the window closed at ledger ${expiresAtLedger}.`,
      earliest,
      expiry,
    };
  }
  return { phase: "executable", reason: null, earliest, expiry };
}

function delayPreview(): string {
  const delay = formatLedgerDuration(TIMELOCK_MIN_DELAY_LEDGERS);
  const grace = formatLedgerDuration(TIMELOCK_GRACE_LEDGERS);
  return `After queueing, earliest execution is about ${delay ?? "the minimum delay"} (${TIMELOCK_MIN_DELAY_LEDGERS} ledgers) and the window stays open for about ${grace ?? "the grace period"} (${TIMELOCK_GRACE_LEDGERS} ledgers).`;
}

/**
 * Pure state machine for the proposal detail timelock actions.
 * Succeeded → needs queue, Queued → waiting or executable, then Executed.
 */
export function deriveProposalExecution(
  input: ProposalExecutionInput,
): ProposalExecutionView {
  const base: ProposalExecutionView = {
    phase: "idle",
    statusMessage: null,
    assumptionNote: null,
    delayPreview: null,
    earliestExecution: null,
    expiry: null,
    queue: HIDDEN,
    execute: HIDDEN,
    cancel: HIDDEN,
  };

  const cancelVisible =
    input.timelockConfigured &&
    input.isProposer &&
    PROPOSER_CANCEL_STATES.has(input.state);

  if (!input.timelockConfigured) {
    if (input.state === ProposalState.Succeeded || input.state === ProposalState.Queued) {
      return {
        ...base,
        phase: "signaling",
        statusMessage: SIGNALING_ONLY_MESSAGE,
      };
    }
    return base;
  }

  if (input.state === ProposalState.Executed) {
    return {
      ...base,
      phase: "executed",
      statusMessage: "This proposal has been executed.",
    };
  }

  if (input.state === ProposalState.Succeeded) {
    return {
      ...base,
      phase: "needs_queue",
      statusMessage: "This proposal succeeded and can be queued for delayed execution.",
      assumptionNote: LEDGER_TIME_ASSUMPTION_NOTE,
      delayPreview: delayPreview(),
      queue: gate(input.walletConnected, input.correctNetwork, null),
      cancel: cancelVisible
        ? gate(input.walletConnected, input.correctNetwork, null)
        : HIDDEN,
    };
  }

  if (input.state === ProposalState.Queued || input.state === ProposalState.Expired) {
    const window = windowCopy(input);
    return {
      ...base,
      phase: window.phase,
      statusMessage:
        window.phase === "executable"
          ? "The execution window is open."
          : window.phase === "expired"
            ? "The execution window has closed."
            : "Waiting for the execution window.",
      assumptionNote: LEDGER_TIME_ASSUMPTION_NOTE,
      earliestExecution: window.earliest,
      expiry: window.expiry,
      execute: gate(input.walletConnected, input.correctNetwork, window.reason),
    };
  }

  if (cancelVisible) {
    return {
      ...base,
      phase: "cancel_only",
      statusMessage: "You can cancel this proposal before it is queued.",
      cancel: gate(input.walletConnected, input.correctNetwork, null),
    };
  }

  return base;
}
