import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Skeleton,
  SkeletonCommunityRow,
  SkeletonProposalRow,
  SkeletonStat,
} from "./Skeleton";

describe("Skeleton", () => {
  it("renders a decorative placeholder that is hidden from assistive tech", () => {
    render(<Skeleton className="h-5 w-32" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).toHaveClass("h-5", "w-32");
  });

  it("defaults to the calmer pulse animation", () => {
    render(<Skeleton />);

    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "data-variant",
      "pulse",
    );
  });

  it("marks an active load with the shimmer animation", () => {
    render(<Skeleton variant="shimmer" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("data-variant", "shimmer");
    expect(skeleton.className).toContain("animate-shimmer");
  });

  it("keeps the shimmer animation behind motion-safe", () => {
    render(<Skeleton variant="shimmer" />);

    expect(screen.getByTestId("skeleton").className).toContain(
      "motion-safe:animate-shimmer",
    );
  });
});

describe("SkeletonStat", () => {
  it("keeps the label visible while the value is still loading", () => {
    render(
      <dl>
        <SkeletonStat label="Name" valueWidth="w-32" />
      </dl>,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toHaveClass("w-32");
  });

  it("renders one placeholder per labeled row", () => {
    render(
      <dl>
        <SkeletonStat label="Symbol" />
        <SkeletonStat label="Your balance" />
      </dl>,
    );

    expect(screen.getByText("Symbol")).toBeInTheDocument();
    expect(screen.getByText("Your balance")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
  });
});

describe("SkeletonCommunityRow", () => {
  it("mirrors the community card chrome with visible stat labels", () => {
    render(
      <ul>
        <li>
          <SkeletonCommunityRow />
        </li>
      </ul>,
    );

    expect(screen.getByText("Proposal threshold")).toBeInTheDocument();
    expect(screen.getByText("Quorum")).toBeInTheDocument();
    expect(screen.getByText("Voting delay")).toBeInTheDocument();
    expect(screen.getByText("Voting period")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("is decorative so the row is not announced twice", () => {
    const { container } = render(<SkeletonCommunityRow />);

    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});

describe("SkeletonProposalRow", () => {
  it("renders the proposal row chrome used by every history list", () => {
    render(<SkeletonProposalRow />);

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveAttribute("data-variant", "shimmer");
    }
  });

  it("stays hidden from assistive technology", () => {
    const { container } = render(<SkeletonProposalRow />);

    expect(
      within(container).queryByText(/proposal/i),
    ).not.toBeInTheDocument();
  });
});
