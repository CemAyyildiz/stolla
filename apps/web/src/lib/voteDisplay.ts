/** Format a bigint as a locale string for display */
export function fmt(n: bigint): string {
  return n.toLocaleString();
}

/** Percentage as an integer 0–100, clamping safely */
export function pct(part: bigint, whole: bigint): number {
  if (whole <= BigInt(0)) return 0;
  const raw = Number((part * BigInt(100)) / whole);
  return Math.min(100, Math.max(0, raw));
}
