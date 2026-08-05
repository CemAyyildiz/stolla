import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import CreateCommunityPage from "@/app/(app)/communities/create/page";

function enterValidMetadata() {
  fireEvent.change(screen.getByLabelText(/Community name/), {
    target: { value: "Builders Guild" },
  });
  fireEvent.change(screen.getByLabelText(/NFT symbol/), {
    target: { value: "BUILD" },
  });
  fireEvent.change(screen.getByLabelText(/Description/), {
    target: { value: "A community for public-goods builders." },
  });
  fireEvent.change(screen.getByLabelText(/NFT collection URI/), {
    target: { value: "ipfs://bafy/collection.json" },
  });
  fireEvent.change(screen.getByLabelText(/Community metadata URI/), {
    target: { value: "https://builders.example/community.json" },
  });
}

describe("CreateCommunityPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("announces inline errors for every missing required metadata field", async () => {
    render(<CreateCommunityPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(screen.getByText("Enter a community name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByText("Enter a collection symbol.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a public community description."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the NFT collection URI.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter the community metadata URI."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Community name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("rejects invalid public URLs and incomplete optional links", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();
    fireEvent.change(screen.getByLabelText(/Logo URI/), {
      target: { value: "http://insecure.example/logo.png" },
    });
    fireEvent.change(screen.getByLabelText("Link label"), {
      target: { value: "Chat" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(
      screen.getByText(
        "Use a valid ipfs:// or https:// URI of at most 256 bytes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the HTTPS link URL.")).toBeInTheDocument();
    expect(
      screen.queryByText("Metadata validated and saved for this wizard session."),
    ).not.toBeInTheDocument();
  });

  it("advances valid metadata without a transaction and preserves it on back", () => {
    render(<CreateCommunityPage />);
    enterValidMetadata();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to governance" }),
    );

    expect(
      screen.getByText("Metadata validated and saved for this wizard session."),
    ).toBeInTheDocument();
    expect(screen.getByText("Governance step placeholder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to metadata" }));
    expect(screen.getByLabelText(/Community name/)).toHaveValue(
      "Builders Guild",
    );
    expect(screen.getByLabelText(/Community metadata URI/)).toHaveValue(
      "https://builders.example/community.json",
    );
  });

  it("restores metadata for the current wizard session after remount", async () => {
    const { unmount } = render(<CreateCommunityPage />);
    enterValidMetadata();
    await waitFor(() =>
      expect(sessionStorage.getItem("stolla:community-wizard:metadata:v1")).toContain(
        "Builders Guild",
      ),
    );
    unmount();

    render(<CreateCommunityPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Community name/)).toHaveValue(
        "Builders Guild",
      ),
    );
    expect(screen.getByLabelText(/NFT collection URI/)).toHaveValue(
      "ipfs://bafy/collection.json",
    );
  });
});
