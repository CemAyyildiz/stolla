/** Covers issue #407: the invite link builder's generated URL and copy affordance. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityInviteLinkBuilder } from "../CommunityInviteLinkBuilder";

const COMMUNITY_ID = "ab".repeat(32);

function stubClipboardWriteText() {
  if (!navigator.clipboard) {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  }
  return vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommunityInviteLinkBuilder", () => {
  it("renders the absolute invite URL for the community", async () => {
    render(<CommunityInviteLinkBuilder communityId={COMMUNITY_ID} />);
    const input = await screen.findByLabelText<HTMLInputElement>("Community invite link");
    expect(input.value).toBe(`${window.location.origin}/communities/${COMMUNITY_ID}?invite=1`);
    expect(input).toHaveAttribute("readOnly");
  });

  it("explains that the link never grants owner/guardian powers", async () => {
    render(<CommunityInviteLinkBuilder communityId={COMMUNITY_ID} />);
    expect(
      await screen.findByText(/Never grants owner or guardian powers/),
    ).toBeInTheDocument();
  });

  it("copies the invite link to the clipboard and shows transient confirmation", async () => {
    // user-event's own setup() installs its own navigator.clipboard stub,
    // so the component's copy stub has to be applied after that, not before.
    const user = userEvent.setup();
    const writeText = stubClipboardWriteText();
    render(<CommunityInviteLinkBuilder communityId={COMMUNITY_ID} />);

    const copyButton = await screen.findByRole("button", { name: "Copy link" });
    await user.click(copyButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/communities/${COMMUNITY_ID}?invite=1`),
    );
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });
});
