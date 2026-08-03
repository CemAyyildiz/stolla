import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionLifecycleDisplay } from "@/components/TransactionLifecycleDisplay";

describe("TransactionLifecycleDisplay", () => {
  it("returns null when stage is idle", () => {
    const { container } = render(
      <TransactionLifecycleDisplay
        stage="idle"
        voteType={null}
        reason=""
        error={null}
        isTerminal={false}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows simulating stage with spinner", () => {
    render(
      <TransactionLifecycleDisplay
        stage="simulating"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("Simulating transaction…")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("shows wallet approval stage", () => {
    render(
      <TransactionLifecycleDisplay
        stage="wallet_approval"
        voteType={0}
        reason="Disagree"
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("Waiting for wallet approval…")).toBeInTheDocument();
    expect(screen.getByText("Against")).toBeInTheDocument();
    expect(screen.getByText("Disagree")).toBeInTheDocument();
  });

  it("shows submitting stage", () => {
    render(
      <TransactionLifecycleDisplay
        stage="submitting"
        voteType={2}
        reason="Neutral"
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("Submitting to network…")).toBeInTheDocument();
    expect(screen.getByText("Abstain")).toBeInTheDocument();
  });

  it("shows confirming stage", () => {
    render(
      <TransactionLifecycleDisplay
        stage="confirming"
        voteType={1}
        reason=""
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("Confirming on ledger…")).toBeInTheDocument();
  });

  it("shows confirmed stage with success", () => {
    render(
      <TransactionLifecycleDisplay
        stage="confirmed"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={true}
      />,
    );
    expect(screen.getByText("Vote confirmed!")).toBeInTheDocument();
    expect(screen.getByText("For")).toBeInTheDocument();
  });

  it("shows wallet rejected stage with error", () => {
    render(
      <TransactionLifecycleDisplay
        stage="wallet_rejected"
        voteType={1}
        reason="Support"
        error="User rejected the transaction"
        isTerminal={true}
      />,
    );
    expect(screen.getByText("Wallet rejected")).toBeInTheDocument();
    expect(screen.getByText("User rejected the transaction")).toBeInTheDocument();
  });

  it("shows simulation failed stage with error", () => {
    render(
      <TransactionLifecycleDisplay
        stage="simulation_failed"
        voteType={0}
        reason="Disagree"
        error="Insufficient resources"
        isTerminal={true}
      />,
    );
    expect(screen.getByText("Simulation failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient resources")).toBeInTheDocument();
  });

  it("shows submission failed stage with error", () => {
    render(
      <TransactionLifecycleDisplay
        stage="submission_failed"
        voteType={1}
        reason="Support"
        error="Network timeout"
        isTerminal={true}
      />,
    );
    expect(screen.getByText("Submission failed")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("shows duplicate vote stage", () => {
    render(
      <TransactionLifecycleDisplay
        stage="duplicate_vote"
        voteType={1}
        reason="Support"
        error="You have already voted on this proposal."
        isTerminal={true}
      />,
    );
    expect(screen.getByText("Already voted")).toBeInTheDocument();
    // Text appears in both error display and sr-only span, use getAllByText
    const matches = screen.getAllByText("You have already voted on this proposal.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("has proper aria-live attributes for accessibility", () => {
    render(
      <TransactionLifecycleDisplay
        stage="simulating"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={false}
      />,
    );
    const statusEl = screen.getByRole("status");
    expect(statusEl).toHaveAttribute("aria-live", "polite");
    expect(statusEl).toHaveTextContent(
      "Transaction update: Simulating transaction…",
    );
    expect(
      screen.getByLabelText("Transaction status: Simulating transaction…"),
    ).toBeInTheDocument();
  });

  it("shows please wait for active stages", () => {
    render(
      <TransactionLifecycleDisplay
        stage="wallet_approval"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("Please wait…")).toBeInTheDocument();
  });

  it("does not show please wait for terminal stages", () => {
    render(
      <TransactionLifecycleDisplay
        stage="confirmed"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={true}
      />,
    );
    expect(screen.queryByText("Please wait…")).not.toBeInTheDocument();
  });

  it("hides reason when empty", () => {
    render(
      <TransactionLifecycleDisplay
        stage="simulating"
        voteType={1}
        reason=""
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.queryByText("Reason")).not.toBeInTheDocument();
  });

  it("shows reason when provided", () => {
    render(
      <TransactionLifecycleDisplay
        stage="simulating"
        voteType={1}
        reason="I support this proposal"
        error={null}
        isTerminal={false}
      />,
    );
    expect(screen.getByText("I support this proposal")).toBeInTheDocument();
  });

  it("renders accessible announcements for screen readers", () => {
    render(
      <TransactionLifecycleDisplay
        stage="confirmed"
        voteType={1}
        reason="Support"
        error={null}
        isTerminal={true}
      />,
    );
    const srOnly = screen.getByText("Vote successfully submitted and confirmed.");
    expect(srOnly).toHaveClass("sr-only");
  });

  it("renders wallet rejection announcement", () => {
    render(
      <TransactionLifecycleDisplay
        stage="wallet_rejected"
        voteType={1}
        reason="Support"
        error="User rejected"
        isTerminal={true}
      />,
    );
    const srOnly = screen.getByText("Wallet rejected the transaction. Your vote was not submitted.");
    expect(srOnly).toHaveClass("sr-only");
    expect(srOnly).toHaveAttribute("role", "alert");
    expect(srOnly).toHaveAttribute("aria-live", "assertive");
  });
});
