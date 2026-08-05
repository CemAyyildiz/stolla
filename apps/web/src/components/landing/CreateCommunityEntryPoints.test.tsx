import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaSection } from "./CtaSection";
import { HeroSection } from "./HeroSection";

describe("landing community creation entry points", () => {
  it("links both accessible actions to the canonical wizard route with fee copy", () => {
    render(
      <>
        <HeroSection />
        <CtaSection />
      </>,
    );
    const actions = screen.getAllByRole("link", {
      name: "Create a community",
    });
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action).toHaveAttribute("href", "/communities/create");
    }
    expect(screen.getAllByText(/network fees/)).toHaveLength(2);
  });
});
