/** Covers issue #406: side-by-side community governance compare view. */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRegistryProvider } from "@/lib/community/CommunityRegistryProvider";
import type { CommunityDetailResult } from "@/lib/community/types";
import CommunitiesComparePage from "@/app/(app)/communities/compare/page";
import {
  MOCK_ACCOUNT_CAROL,
  MOCK_ACCOUNT_OWNER,
  MOCK_CONTRACT_A,
  MOCK_CONTRACT_B,
} from "@/test-support/stellar/fixtures";

const ID_A = "aa".repeat(32);
const ID_B = "bb".repeat(32);

function foundResult(name: string, overrides: Partial<CommunityDetailResult & { status: "found" }> = {}): CommunityDetailResult {
  return {
    status: "found",
    community: {
      record: {
        id: name === "Alpha" ? ID_A : ID_B,
        nftContract: MOCK_CONTRACT_A,
        governorContract: MOCK_CONTRACT_B,
        creator: MOCK_ACCOUNT_CAROL,
        communityOwner: MOCK_ACCOUNT_OWNER,
        createdAtLedger: 100,
        creationIndex: 1,
        metadataUri: "https://example.test/community.json",
        metadataHash: "cd".repeat(32),
        metadataSchemaVersion: 1,
      },
      metadata: { schemaVersion: 1, name, description: "", externalLinks: [] },
      metadataError: null,
      governance: {
        votingDelay: 10,
        votingPeriod: 100,
        proposalThreshold: "5",
        quorum: "20",
        unavailableFields: [],
      },
    },
    ...overrides,
  } as CommunityDetailResult;
}

function renderPage(get: (id: string) => Promise<CommunityDetailResult>) {
  const registry = { list: vi.fn(), get: vi.fn(get) };
  return render(
    <CommunityRegistryProvider registry={registry}>
      <CommunitiesComparePage />
    </CommunityRegistryProvider>,
  );
}

describe("CommunitiesComparePage", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/communities/compare");
  });

  it("shows an actionable error and no RPC calls when ids are missing", async () => {
    window.history.pushState({}, "", "/communities/compare");
    const get = vi.fn();
    renderPage(get);

    expect(
      await screen.findByText("Compare needs exactly two community IDs"),
    ).toBeInTheDocument();
    expect(screen.getByText(/No community IDs were given/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("shows an actionable error when only one id is given", async () => {
    window.history.pushState({}, "", `/communities/compare?ids=${ID_A}`);
    renderPage(vi.fn());

    expect(
      await screen.findByText("Compare needs exactly two community IDs"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 community IDs were given/)).toBeInTheDocument();
  });

  it("renders governance params for two found communities and flags unequal quorum", async () => {
    window.history.pushState({}, "", `/communities/compare?ids=${ID_A},${ID_B}`);
    const alpha = foundResult("Alpha");
    const beta = foundResult("Beta");
    if (beta.status === "found") {
      beta.community.governance = { ...beta.community.governance, quorum: "50" };
    }
    const get = vi.fn(async (id: string) => (id === ID_A ? alpha : beta));
    renderPage(get);

    // "Alpha"/"Beta" legitimately appear twice each (slot header + the
    // metadata table's Name row), so assert on that count rather than a
    // single ambiguous match.
    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(2));
    expect(screen.getAllByText("Beta")).toHaveLength(2);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    // "Differs" badges on both the Name row (Alpha vs Beta) and the Quorum
    // row (20 vs 50) — both are genuine, correct diffs.
    expect(screen.getAllByText("Differs")).toHaveLength(2);
  });

  it("shows an actionable not-found message for one slot without blocking the other", async () => {
    window.history.pushState({}, "", `/communities/compare?ids=${ID_A},${ID_B}`);
    const get = vi.fn(async (id: string) =>
      id === ID_A ? foundResult("Alpha") : ({ status: "not-found" } as CommunityDetailResult),
    );
    renderPage(get);

    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(2));
    expect(
      screen.getByText("This ID is malformed or is not present in the canonical registry."),
    ).toBeInTheDocument();
    // Alpha's own governance values still render even though the other slot failed.
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("links back to each community's detail page", async () => {
    window.history.pushState({}, "", `/communities/compare?ids=${ID_A},${ID_B}`);
    const get = vi.fn(async (id: string) => (id === ID_A ? foundResult("Alpha") : foundResult("Beta")));
    renderPage(get);

    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(2));
    const links = screen.getAllByRole("link", { name: "View community" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expect.arrayContaining([`/communities/${ID_A}`, `/communities/${ID_B}`]),
    );
  });
});
