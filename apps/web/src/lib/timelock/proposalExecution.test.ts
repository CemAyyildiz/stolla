import { describe, expect, it } from "vitest";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import {
  deriveProposalExecution,
  SIGNALING_ONLY_MESSAGE,
  type ProposalExecutionInput,
} from "./proposalExecution";

function input(overrides: Partial<ProposalExecutionInput> = {}): ProposalExecutionInput {
  return {
    state: ProposalState.Succeeded,
    timelockConfigured: true,
    etaLedger: null,
    expiresAtLedger: null,
    currentLedger: 1_000,
    isProposer: false,
    walletConnected: true,
    correctNetwork: true,
    ...overrides,
  };
}

describe("deriveProposalExecution", () => {
  it("keeps signaling copy and hides actions when Timelock is absent", () => {
    const view = deriveProposalExecution(
      input({ timelockConfigured: false, state: ProposalState.Succeeded }),
    );
    expect(view.phase).toBe("signaling");
    expect(view.statusMessage).toBe(SIGNALING_ONLY_MESSAGE);
    expect(view.queue.visible).toBe(false);
    expect(view.execute.visible).toBe(false);
    expect(view.cancel.visible).toBe(false);
  });

  it("moves succeeded proposals through queue, the window, and execution", () => {
    const succeeded = deriveProposalExecution(input({ isProposer: true }));
    expect(succeeded.phase).toBe("needs_queue");
    expect(succeeded.queue).toMatchObject({ visible: true, disabled: false });
    expect(succeeded.cancel).toMatchObject({ visible: true, disabled: false });
    expect(succeeded.execute.visible).toBe(false);
    expect(succeeded.delayPreview).toMatch(/34560 ledgers/);

    const waiting = deriveProposalExecution(
      input({
        state: ProposalState.Queued,
        etaLedger: 2_000,
        expiresAtLedger: 3_000,
        currentLedger: 1_000,
      }),
    );
    expect(waiting.phase).toBe("waiting");
    expect(waiting.execute.disabled).toBe(true);
    expect(waiting.execute.reason).toMatch(/until ledger 2000/);
    expect(waiting.earliestExecution).toMatch(/Ledger 2000/);
    expect(waiting.expiry).toMatch(/Ledger 3000/);
    expect(waiting.cancel.visible).toBe(false);

    const executable = deriveProposalExecution(
      input({
        state: ProposalState.Queued,
        etaLedger: 2_000,
        expiresAtLedger: 3_000,
        currentLedger: 2_500,
      }),
    );
    expect(executable.phase).toBe("executable");
    expect(executable.execute).toMatchObject({ visible: true, disabled: false });

    const expired = deriveProposalExecution(
      input({
        state: ProposalState.Queued,
        etaLedger: 2_000,
        expiresAtLedger: 3_000,
        currentLedger: 3_001,
      }),
    );
    expect(expired.phase).toBe("expired");
    expect(expired.execute.disabled).toBe(true);
    expect(expired.execute.reason).toMatch(/closed at ledger 3000/);

    const executed = deriveProposalExecution(
      input({ state: ProposalState.Executed }),
    );
    expect(executed.phase).toBe("executed");
    expect(executed.execute.visible).toBe(false);
    expect(executed.queue.visible).toBe(false);
  });

  it("disables queue when the wallet is disconnected", () => {
    const view = deriveProposalExecution(input({ walletConnected: false }));
    expect(view.queue.disabled).toBe(true);
    expect(view.queue.reason).toMatch(/Connect a wallet/);
  });
});
