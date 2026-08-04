import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import type { ProposalSummary } from "@/lib/proposal/types";

const FULL_ID = "ab".repeat(32);

function baseSummary(
  overrides: Partial<ProposalSummary> = {},
): Pick<ProposalSummary, "proposalId"> &
  Partial<
    Pick<
      ProposalSummary,
      "description" | "proposer" | "voteSnapshot" | "voteEnd"
    >
  > {
  return {
    proposalId: FULL_ID,
    ...overrides,
  };
}

describe("ProposalSummaryCard", () => {
  it("renders a complete summary with accessible detail link", () => {
    render(
      <ProposalSummaryCard
        summary={baseSummary({
          description: "Fund community grants",
          proposer: "GABCDEFGHIJKLMNOPQRSTUVWXYZ",
        })}
        stateStatus="ready"
        stateLabel="Active"
        onCopyId={() => undefined}
      />,
    );

    const link = screen.getByRole("link", {
      name: new RegExp(`View proposal ${FULL_ID}, state Active`),
    });
    expect(link).toHaveAttribute("href", `/proposals/${FULL_ID}`);
    expect(screen.getByText("Fund community grants")).toBeInTheDocument();
    expect(screen.getByText("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBeInTheDocument();
  });

  it("shows placeholders for partial optional metadata", () => {
    render(
      <ProposalSummaryCard
        summary={baseSummary({
          description: "",
          proposer: null,
        })}
        stateStatus="ready"
        stateLabel="Pending"
      />,
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
  });

  it("supports loading and failed state presentation", () => {
    const { rerender } = render(
      <ProposalSummaryCard
        summary={baseSummary()}
        stateStatus="loading"
      />,
    );
    expect(screen.getByText("…")).toBeInTheDocument();

    const onRetryState = vi.fn();
    rerender(
      <ProposalSummaryCard
        summary={baseSummary()}
        stateStatus="unavailable"
        onRetryState={onRetryState}
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Retry loading state for proposal ${FULL_ID}`,
      }),
    );
    expect(onRetryState).toHaveBeenCalledTimes(1);
  });

  it("keeps long proposal IDs from breaking the layout", () => {
    const { container } = render(
      <ProposalSummaryCard
        summary={baseSummary({ proposalId: "ff".repeat(32) })}
        stateStatus="ready"
        stateLabel="Queued"
      />,
    );

    const mono = container.querySelector(".truncate.font-mono");
    expect(mono).toBeTruthy();
    expect(mono).toHaveAttribute("title", "ff".repeat(32));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/proposals/${"ff".repeat(32)}`,
    );
  });
});
