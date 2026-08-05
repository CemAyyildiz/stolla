import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import {
  resolveTransactionLifecycleStage,
  TRANSACTION_LIFECYCLE_STAGES,
} from "@/lib/transactionLifecycle";

describe("transactionLifecycle model", () => {
  it("represents lifecycle states as a typed finite set", () => {
    expect(TRANSACTION_LIFECYCLE_STAGES).toEqual([
      "idle",
      "simulating",
      "awaiting_approval",
      "submitting",
      "confirming",
      "success",
      "failure",
    ]);
  });

  it("falls back safely for unknown stages", () => {
    expect(resolveTransactionLifecycleStage("not-a-stage")).toBe("failure");
    expect(resolveTransactionLifecycleStage(null)).toBe("failure");
    expect(resolveTransactionLifecycleStage("success")).toBe("success");
  });
});

describe("TransactionLifecycleStatus", () => {
  it("hides idle by default", () => {
    const { container } = render(
      <TransactionLifecycleStatus stage="idle" operationLabel="Mint" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it.each([
    ["simulating", "Simulating transaction…", "Pending"],
    ["awaiting_approval", "Waiting for wallet approval…", "Pending"],
    ["submitting", "Submitting to network…", "Pending"],
    ["confirming", "Confirming on ledger…", "Pending"],
    ["success", "Mint confirmed", "Success"],
    ["failure", "Mint failed", "Failed"],
  ] as const)(
    "renders %s with clear copy and a non-color marker",
    (stage, label, marker) => {
      render(
        <TransactionLifecycleStatus
          stage={stage}
          operationLabel="Mint"
          error={stage === "failure" ? "RPC unavailable" : null}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(marker)).toBeInTheDocument();
      expect(
        screen.getByLabelText(`Mint status: ${label}`),
      ).toBeInTheDocument();
    },
  );

  it("announces status updates through a live region", () => {
    render(
      <TransactionLifecycleStatus stage="submitting" operationLabel="Delegate" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(
      "Delegate update: Submitting to network…",
    );
  });

  it("uses an assertive alert for failures", () => {
    render(
      <TransactionLifecycleStatus
        stage="failure"
        operationLabel="Propose"
        error="Simulation rejected"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Propose failed: Simulation rejected.");
  });

  it("renders optional metadata without horizontal overflow classes", () => {
    const hash = "a".repeat(64);
    const { container } = render(
      <TransactionLifecycleStatus
        stage="success"
        operationLabel="Vote"
        metadata={{
          transactionHash: hash,
          details: [
            { label: "Vote", value: "For" },
            { label: "Reason", value: "Support the treasury expansion plan" },
          ],
        }}
      />,
    );

    expect(screen.getByText("For")).toBeInTheDocument();
    expect(
      screen.getByText("Support the treasury expansion plan"),
    ).toBeInTheDocument();
    expect(screen.getByTitle(hash)).toHaveTextContent(hash);
    expect(container.firstChild).toHaveClass("overflow-hidden");
    expect(container.firstChild).toHaveClass("min-w-0");
    expect(container.firstChild).toHaveClass("max-w-full");
  });

  it("shows idle when explicitly requested", () => {
    render(
      <TransactionLifecycleStatus
        stage="idle"
        operationLabel="Mint"
        showIdle
      />,
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("maps impossible stage values to the failure fallback", () => {
    render(
      <TransactionLifecycleStatus
        stage="totally-invalid"
        operationLabel="Mint"
        error="Unexpected lifecycle state"
      />,
    );
    expect(screen.getByText("Mint failed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
