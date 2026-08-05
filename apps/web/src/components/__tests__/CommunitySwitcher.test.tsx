import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityView } from "@/lib/community/types";

const mocks = vi.hoisted(() => ({
  pathname: vi.fn(),
  listCommunities: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.pathname,
}));
vi.mock("@/lib/community/registry", () => ({
  listCommunities: mocks.listCommunities,
}));

import { CommunitySwitcher } from "../CommunitySwitcher";

const ID = "ab".repeat(32);
const community = {
  record: { id: ID },
  metadata: { name: "Builders Guild" },
} as CommunityView;

describe("CommunitySwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname.mockReturnValue(`/communities/${ID}`);
    mocks.listCommunities.mockResolvedValue({
      communities: [community],
      nextCursor: null,
      malformedRecords: 0,
    });
  });

  it("loads route-selected communities and supports search and selection", async () => {
    render(<CommunitySwitcher />);
    fireEvent.click(screen.getByRole("button"));

    const search = await screen.findByLabelText("Search communities");
    expect(search).toHaveFocus();
    expect(
      screen.getByRole("link", { name: /Builders Guild/ }),
    ).toHaveAttribute("aria-current", "page");

    fireEvent.change(search, { target: { value: "missing" } });
    expect(
      screen.getByText("No communities match this search."),
    ).toBeInTheDocument();
  });

  it("closes on Escape and reports unknown route IDs", async () => {
    mocks.listCommunities.mockResolvedValue({
      communities: [],
      nextCursor: null,
      malformedRecords: 0,
    });
    render(<CommunitySwitcher />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    await screen.findByText("No communities are registered.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent("Unknown community");
  });
});
