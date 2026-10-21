import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import type { TimelockCallResult } from "@/lib/timelock/client";
import {
  SIGNALING_ONLY_MESSAGE,
  type ProposalExecutionInput,
} from "@/lib/timelock/proposalExecution";
import { ProposalTimelockActions } from "./ProposalTimelockActions";

function input(overrides: Partial<ProposalExecutionInput> = {}): ProposalExecutionInput {
  return {
    state: ProposalState.Succeeded,
    timelockConfigured: true,
    etaLedger: null,
    expiresAtLedger: null,
    currentLedger: 1_000,
    isProposer: true,
    walletConnected: true,
    correctNetwork: true,
    ...overrides,
  };
}

describe("ProposalTimelockActions", () => {
  it("walks Succeeded → Queued → Executable → Executed", () => {
    const onSubmit = vi.fn(async (): Promise<TimelockCallResult> => ({
      ok: true,
      transactionHash: null,
    }));
    const { rerender } = render(
      <ProposalTimelockActions input={input()} onSubmit={onSubmit} />,
    );

    expect(screen.getByRole("button", { name: "Queue" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Execute" })).not.toBeInTheDocument();
    expect(screen.getByText(/34560 ledgers/)).toBeInTheDocument();

    rerender(
      <ProposalTimelockActions
        input={input({
          state: ProposalState.Queued,
          isProposer: false,
          etaLedger: 2_000,
          expiresAtLedger: 3_000,
          currentLedger: 1_280,
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByRole("button", { name: "Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Execute" })).toBeDisabled();
    expect(screen.getByText(/until ledger 2000/)).toBeInTheDocument();
    expect(screen.getByText(/Ledger 2000/)).toBeInTheDocument();
    expect(screen.getByText(/Ledger 3000/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the execution window/)).toBeInTheDocument();

    rerender(
      <ProposalTimelockActions
        input={input({
          state: ProposalState.Queued,
          isProposer: false,
          etaLedger: 2_000,
          expiresAtLedger: 3_000,
          currentLedger: 2_000,
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: "Execute" })).toBeEnabled();
    expect(screen.getByText(/The execution window is open/)).toBeInTheDocument();

    rerender(
      <ProposalTimelockActions
        input={input({ state: ProposalState.Executed, isProposer: false })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByRole("button", { name: "Execute" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Queue" })).not.toBeInTheDocument();
    expect(screen.getByText(/has been executed/)).toBeInTheDocument();
  });

  it("shows signaling copy and no actions when Timelock is absent", () => {
    render(
      <ProposalTimelockActions
        input={input({ timelockConfigured: false })}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(SIGNALING_ONLY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the draft action and error when the wallet rejects", async () => {
    const onSubmit = vi.fn(
      async (): Promise<TimelockCallResult> => ({
        ok: false,
        kind: "wallet_rejected",
        message: "You rejected the wallet request. Approve the next prompt to continue.",
      }),
    );
    render(<ProposalTimelockActions input={input()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/rejected the wallet request/i);
    expect(screen.getByText("Draft kept: queue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queue" })).toBeEnabled();
    expect(onSubmit).toHaveBeenCalledWith("queue");
  });
});
