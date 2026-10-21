"use client";

import { useEffect, useState } from "react";
import { readTimelockWindow, type TimelockWindow } from "./client";

const EMPTY_WINDOW: TimelockWindow = {
  etaLedger: null,
  expiresAtLedger: null,
  currentLedger: null,
};

/**
 * Loads the timelock window when a contract id is configured and the caller
 * did not already supply one. A missing id never touches RPC.
 */
export function useTimelockWindow(
  contractId: string | null,
  proposalIdHex: string,
  publicKey: string | undefined,
  preset: TimelockWindow | undefined,
): { window: TimelockWindow; error: string | null } {
  const [remote, setRemote] = useState<TimelockWindow>(EMPTY_WINDOW);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preset || !contractId) return;
    let cancelled = false;
    readTimelockWindow({ contractId, proposalIdHex, publicKey })
      .then((next) => {
        if (cancelled) return;
        setRemote(next);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Timelock window could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [contractId, proposalIdHex, publicKey, preset]);

  if (preset) return { window: preset, error: null };
  if (!contractId) return { window: EMPTY_WINDOW, error: null };
  return { window: remote, error };
}
