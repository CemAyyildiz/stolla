/**
 * Pure comparison helpers for the two-community governance compare view
 * (issue #406). Kept side-effect free so the diff logic is unit-testable
 * without any live RPC or registry.
 */
import { GOVERNANCE_HELPERS } from "@/lib/community/governanceDisplay";
import type { CommunityMetadata, GovernanceSnapshot } from "@/lib/community/types";

export type GovernanceFieldKey = Exclude<keyof GovernanceSnapshot, "unavailableFields">;

const GOVERNANCE_FIELD_ORDER: { key: GovernanceFieldKey; label: string }[] = [
  { key: "proposalThreshold", label: "Proposal threshold (NFT votes)" },
  { key: "quorum", label: "Quorum (NFT votes)" },
  { key: "votingDelay", label: "Voting delay (Stellar ledgers)" },
  { key: "votingPeriod", label: "Voting period (Stellar ledgers)" },
];

export interface CompareCellValue {
  /** Display text, or null when the value is unavailable for this slot. */
  text: string | null;
}

export interface CompareRow {
  key: string;
  label: string;
  helper?: string;
  a: CompareCellValue;
  b: CompareCellValue;
  /**
   * True only when both sides have a known value and they differ. A row
   * where either side is unavailable is never flagged as "differs" — there
   * is nothing to meaningfully diff against, so it would be noise rather
   * than a real divergence.
   */
  differs: boolean;
}

function governanceValueText(value: string | number | null): string | null {
  if (value === null) return null;
  return String(value);
}

/**
 * Builds the governance parameter rows for two communities. Either snapshot
 * may be `null` (community not loaded / not found) — that side's cells
 * simply read as unavailable rather than blocking the other side's values.
 */
export function buildGovernanceComparisonRows(
  governanceA: GovernanceSnapshot | null,
  governanceB: GovernanceSnapshot | null,
): CompareRow[] {
  return GOVERNANCE_FIELD_ORDER.map(({ key, label }) => {
    const textA = governanceValueText(governanceA ? governanceA[key] : null);
    const textB = governanceValueText(governanceB ? governanceB[key] : null);
    return {
      key,
      label,
      helper: GOVERNANCE_HELPERS[key],
      a: { text: textA },
      b: { text: textB },
      differs: textA !== null && textB !== null && textA !== textB,
    };
  });
}

/** Basic (non-governance) metadata rows shown above the governance table. */
export function buildMetadataComparisonRows(
  metadataA: CommunityMetadata | null,
  createdAtLedgerA: number | null,
  metadataB: CommunityMetadata | null,
  createdAtLedgerB: number | null,
): CompareRow[] {
  const nameA = metadataA?.name ?? null;
  const nameB = metadataB?.name ?? null;
  const ledgerA = createdAtLedgerA === null ? null : String(createdAtLedgerA);
  const ledgerB = createdAtLedgerB === null ? null : String(createdAtLedgerB);

  return [
    {
      key: "name",
      label: "Name",
      a: { text: nameA },
      b: { text: nameB },
      differs: nameA !== null && nameB !== null && nameA !== nameB,
    },
    {
      key: "createdAtLedger",
      label: "Created at ledger",
      a: { text: ledgerA },
      b: { text: ledgerB },
      differs: ledgerA !== null && ledgerB !== null && ledgerA !== ledgerB,
    },
  ];
}

/** Parses the `ids` query param into a trimmed, non-empty id list. */
export function parseCompareIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}
