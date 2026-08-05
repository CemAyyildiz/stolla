import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveStatus } from "./LiveStatus";

describe("LiveStatus", () => {
  it("uses non-interruptive semantics for routine updates", () => {
    render(<LiveStatus>Submitting transaction…</LiveStatus>);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("uses alert semantics for failures", () => {
    render(<LiveStatus tone="error">Transaction failed.</LiveStatus>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-atomic", "true");
  });

  it("keeps the same live node when an unchanged message re-renders", () => {
    const { rerender } = render(<LiveStatus>Wallet connected.</LiveStatus>);
    const originalNode = screen.getByRole("status");

    rerender(<LiveStatus>Wallet connected.</LiveStatus>);

    expect(screen.getByRole("status")).toBe(originalNode);
    expect(screen.getByRole("status")).toHaveTextContent("Wallet connected.");
  });
});
