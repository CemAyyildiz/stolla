import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityView } from "@/lib/community/types";

const mocks = vi.hoisted(() => ({
  listCommunities: vi.fn(),
}));

vi.mock("@/lib/community/registry", () => ({
  listCommunities: mocks.listCommunities,
}));

import CommunitiesPage from "@/app/(app)/communities/page";

function community(idByte: string, name = "Builders Guild"): CommunityView {
  return {
    record: {
      id: idByte.repeat(64),
      nftContract: "CNFT",
      governorContract: "CGOV",
      creator: "GCREATOR",
      communityOwner: "GOWNER",
      createdAtLedger: 100,
      creationIndex: 0,
      metadataUri: "https://example.test/community.json",
      metadataHash: "ab".repeat(32),
      metadataSchemaVersion: 1,
    },
    metadata: {
      schemaVersion: 1,
      name,
      description: "A public-goods builder community.",
      externalLinks: [],
    },
    metadataError: null,
    governance: {
      votingDelay: 12,
      votingPeriod: 17_280,
      proposalThreshold: "1",
      quorum: "10",
      unavailableFields: [],
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("CommunitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state and renders registry communities without a wallet", async () => {
    const request = deferred<{
      communities: CommunityView[];
      nextCursor: null;
      malformedRecords: number;
    }>();
    mocks.listCommunities.mockReturnValue(request.promise);

    render(<CommunitiesPage />);
    expect(
      screen.getByText("Loading registered communities…"),
    ).toBeInTheDocument();

    await act(async () => {
      request.resolve({
        communities: [community("a")],
        nextCursor: null,
        malformedRecords: 0,
      });
    });

    expect(await screen.findByText("Builders Guild")).toBeInTheDocument();
    expect(screen.getByText(/17280 ledgers/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "View Builders Guild community details",
      }),
    ).toHaveAttribute("href", `/communities/${"a".repeat(64)}`);
  });

  it("renders an accessible empty registry state", async () => {
    mocks.listCommunities.mockResolvedValue({
      communities: [],
      nextCursor: null,
      malformedRecords: 0,
    });

    render(<CommunitiesPage />);

    expect(
      await screen.findByText(/No communities are registered yet/),
    ).toHaveAttribute("role", "status");
  });

  it("shows an RPC error and can retry", async () => {
    mocks.listCommunities
      .mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockResolvedValueOnce({
        communities: [community("b", "Civic DAO")],
        nextCursor: null,
        malformedRecords: 0,
      });

    render(<CommunitiesPage />);
    expect(
      await screen.findByText("Community registry is temporarily unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByText("RPC unavailable")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry registry request" }),
    );
    expect(await screen.findByText("Civic DAO")).toBeInTheDocument();
  });

  it("retains valid entries and reports malformed and partial records", async () => {
    const partial = community("c");
    partial.metadata = null;
    partial.metadataError = "Hash mismatch";
    partial.governance.unavailableFields = ["Quorum"];
    partial.governance.quorum = null;
    mocks.listCommunities.mockResolvedValue({
      communities: [partial],
      nextCursor: null,
      malformedRecords: 1,
    });

    render(<CommunitiesPage />);

    expect(
      await screen.findByText(/Some registry data is unavailable/),
    ).toHaveTextContent("1 malformed or duplicate record was skipped");
    expect(
      screen.getByText(/Metadata unavailable. The verified registry record/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View Community/ }),
    ).toBeInTheDocument();
  });

  it("appends cursor pages without duplicating community IDs", async () => {
    const first = community("d", "First DAO");
    const second = community("e", "Second DAO");
    mocks.listCommunities
      .mockResolvedValueOnce({
        communities: [first],
        nextCursor: 1,
        malformedRecords: 0,
      })
      .mockResolvedValueOnce({
        communities: [first, second],
        nextCursor: null,
        malformedRecords: 0,
      });

    render(<CommunitiesPage />);
    expect(await screen.findByText("First DAO")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Load more communities" }),
    );

    expect(await screen.findByText("Second DAO")).toBeInTheDocument();
    expect(screen.getAllByText("First DAO")).toHaveLength(1);
    expect(
      screen.getByText(/1 malformed or duplicate record was skipped/),
    ).toBeInTheDocument();
  });
});
