/**
 * Fee utility helpers — exact integer arithmetic for Soroban resource fees.
 *
 * Soroban fees are returned in **stroops** (1 XLM = 10_000_000 stroops).
 * All conversions use BigInt to avoid precision loss with large values.
 */

const STROOPS_PER_XLM = 10_000_000n;

/** Convert stroops to XLM string with up to 7 decimal places. */
export function stroopsToXlm(stroops: bigint | string | number): string {
  const s = BigInt(stroops);
  const whole = s / STROOPS_PER_XLM;
  const frac = s % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/** Convert XLM string back to stroops. */
export function xlmToStroops(xlm: string): bigint {
  const [whole, frac] = xlm.split(".");
  const wholePart = BigInt(whole) * STROOPS_PER_XLM;
  const fracPart = frac
    ? BigInt(frac.padEnd(7, "0").slice(0, 7))
    : 0n;
  return wholePart + fracPart;
}

/** Simulation result shape expected from Soroban RPC. */
export interface SimulationResult {
  /** Total resource fee in stroops. */
  resourceFee: bigint | string | number;
  /** CPU instructions consumed. */
  cpuInstructions: bigint | string | number;
  /** Ledger read bytes. */
  readBytes: bigint | string | number;
  /** Ledger write bytes. */
  writeBytes: bigint | string | number;
  /** Transaction data size in bytes. */
  transactionSizeBytes: bigint | string | number;
}

/** Possible states for a simulation. */
export type SimulationStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: SimulationResult }
  | { kind: "stale" }
  | { kind: "error"; message: string; insufficientResources: boolean };

/** Extract a display-friendly fee breakdown from a simulation result. */
export function formatFeeBreakdown(
  result: SimulationResult,
): { stroops: string; xlm: string; cpu: string; readBytes: string; writeBytes: string } {
  return {
    stroops: String(result.resourceFee),
    xlm: stroopsToXlm(result.resourceFee),
    cpu: String(result.cpuInstructions),
    readBytes: String(result.readBytes),
    writeBytes: String(result.writeBytes),
  };
}
