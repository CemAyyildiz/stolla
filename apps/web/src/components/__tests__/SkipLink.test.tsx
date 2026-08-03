import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkipLink } from "../SkipLink";

describe("SkipLink", () => {
  it("focuses the main content target when activated", () => {
    const scrollIntoView = vi.fn();

    render(
      <>
        <SkipLink />
        <main
          id="main-content"
          tabIndex={-1}
          ref={(node) => {
            if (node) node.scrollIntoView = scrollIntoView;
          }}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});
