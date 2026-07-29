"use client";

import { useNetworkGuard } from "@/hooks/useNetworkGuard";

export function NetworkBadge() {
  const comparison = useNetworkGuard();
  const mismatched = comparison.status === "mismatch";

  return (
    <span
      title={
        mismatched
          ? `Wallet is on ${comparison.detected.label}, expected ${comparison.expected.label}`
          : `Application network: ${comparison.expected.label}`
      }
      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
        mismatched
          ? "border-amber-700 bg-amber-950/60 text-amber-200"
          : "border-slate-700 text-slate-400"
      }`}
    >
      {mismatched
        ? `Wrong network: ${comparison.detected.label}`
        : comparison.expected.label}
    </span>
  );
}
