import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// next/link relies on the App Router's context (prefetch scheduler, etc.)
// which isn't present in a jsdom unit test. Component tests only need the
// resulting <a href> and its keyboard-activation semantics, so swap it for
// a plain anchor everywhere.
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(
    function MockLink({ href, children, ...rest }, ref) {
      return React.createElement("a", { href, ref, ...rest }, children);
    },
  ),
}));
