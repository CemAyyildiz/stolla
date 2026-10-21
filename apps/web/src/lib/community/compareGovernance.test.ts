import { describe, expect, it } from "vitest";
import {
  buildGovernanceComparisonRows,
  buildMetadataComparisonRows,
  parseCompareIds,
} from "./compareGovernance";
import type { CommunityMetadata, GovernanceSnapshot } from "./types";

function governance(overrides: Partial<GovernanceSnapshot> = {}): GovernanceSnapshot {
  return {
    votingDelay: 10,
    votingPeriod: 100,
    proposalThreshold: "5",
    quorum: "20",
    unavailableFields: [],
    ...overrides,
  };
}

function metadata(name: string): CommunityMetadata {
  return { schemaVersion: 1, name, description: "", externalLinks: [] };
}

describe("parseCompareIds", () => {
  it("parses a comma-separated ids param", () => {
    expect(parseCompareIds("aaa,bbb")).toEqual(["aaa", "bbb"]);
  });

  it("trims whitespace and drops empty segments", () => {
    expect(parseCompareIds(" aaa , , bbb ")).toEqual(["aaa", "bbb"]);
  });

  it("returns an empty array for null or empty input", () => {
    expect(parseCompareIds(null)).toEqual([]);
    expect(parseCompareIds("")).toEqual([]);
  });
});

describe("buildGovernanceComparisonRows", () => {
  it("renders equal params without flagging a diff", () => {
    const rows = buildGovernanceComparisonRows(governance(), governance());
    expect(rows.every((row) => !row.differs)).toBe(true);
    expect(rows.find((row) => row.key === "quorum")?.a.text).toBe("20");
    expect(rows.find((row) => row.key === "quorum")?.b.text).toBe("20");
  });

  it("flags rows where values differ between the two communities", () => {
    const rows = buildGovernanceComparisonRows(
      governance({ quorum: "20" }),
      governance({ quorum: "50" }),
    );
    const quorumRow = rows.find((row) => row.key === "quorum");
    expect(quorumRow?.differs).toBe(true);
    expect(quorumRow?.a.text).toBe("20");
    expect(quorumRow?.b.text).toBe("50");
  });

  it("does not flag a diff when either side is unavailable", () => {
    const rows = buildGovernanceComparisonRows(
      governance({ quorum: "20" }),
      governance({ quorum: null }),
    );
    const quorumRow = rows.find((row) => row.key === "quorum");
    expect(quorumRow?.differs).toBe(false);
    expect(quorumRow?.a.text).toBe("20");
    expect(quorumRow?.b.text).toBeNull();
  });

  it("marks every row unavailable when a snapshot is entirely missing (not-found community)", () => {
    const rows = buildGovernanceComparisonRows(null, governance());
    expect(rows.every((row) => row.a.text === null)).toBe(true);
    expect(rows.every((row) => !row.differs)).toBe(true);
    expect(rows.find((row) => row.key === "votingDelay")?.b.text).toBe("10");
  });

  it("includes the governance helper text for each row", () => {
    const rows = buildGovernanceComparisonRows(governance(), governance());
    expect(rows.find((row) => row.key === "proposalThreshold")?.helper).toMatch(/spam/i);
  });
});

describe("buildMetadataComparisonRows", () => {
  it("flags a differing name but not a matching created-at ledger", () => {
    const rows = buildMetadataComparisonRows(metadata("Alpha"), 100, metadata("Beta"), 100);
    expect(rows.find((row) => row.key === "name")?.differs).toBe(true);
    expect(rows.find((row) => row.key === "createdAtLedger")?.differs).toBe(false);
  });

  it("treats a missing metadata side as unavailable, not a diff", () => {
    const rows = buildMetadataComparisonRows(null, null, metadata("Beta"), 100);
    const nameRow = rows.find((row) => row.key === "name");
    expect(nameRow?.a.text).toBeNull();
    expect(nameRow?.b.text).toBe("Beta");
    expect(nameRow?.differs).toBe(false);
  });
});
