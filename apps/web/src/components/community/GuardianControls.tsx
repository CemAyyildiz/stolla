"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useOptionalWallet } from "@/context/WalletProvider";
import { config } from "@/lib/stellar";
import { mapTransactionError } from "@/lib/transactionErrors";
import {
  guardianAdapter,
  type GuardianAction,
  type GuardianAdapter,
  type GuardianState,
} from "@/lib/community/guardian";

export function GuardianControls({
  timelockId,
  adapter = guardianAdapter,
}: {
  timelockId: string;
  adapter?: GuardianAdapter;
}) {
  const wallet = useOptionalWallet();
  const [state, setState] = useState<GuardianState | null>(null);
  const [readError, setReadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState("120");
  const [reasonHash, setReasonHash] = useState("");
  const [actionId, setActionId] = useState("");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const current = await adapter.read(timelockId);
      setState(current);
      setReadError(false);
    } catch {
      setState(null);
      setReadError(true);
    }
  }, [adapter, timelockId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const isGuardian = Boolean(wallet?.address && state?.guardian === wallet.address);
  const networkReady = wallet?.walletNetworkPassphrase === config.networkPassphrase;
  const canAct = isGuardian && networkReady;

  async function submit(action: GuardianAction) {
    if (inFlight.current || !canAct || !wallet?.address || !state) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("Waiting for wallet approval and network confirmation…");
    try {
      await adapter.submit(timelockId, wallet.address, wallet.signTransaction, action);
      setMessage("Emergency action confirmed. Refreshing on-chain state…");
      await refresh();
      setMessage("Emergency action confirmed on-chain.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.startsWith("Only the configured Guardian")
          ? error.message
          : mapTransactionError(error).message,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!state && !readError) return null;
  if (readError) {
    return (
      <section className="mt-6 rounded-xl border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p>Emergency state could not be read from this community&apos;s Timelock.</p>
        <AppButton tone="secondary" className="mt-3" onClick={() => void refresh()}>
          Retry emergency state
        </AppButton>
      </section>
    );
  }
  if (!state) return null;

  return (
    <section aria-label="Community emergency controls" className="mt-6 space-y-4">
      {state.paused && (
        <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-950/80 p-5 text-rose-100">
          <h2 className="text-lg font-bold">Community paused</h2>
          <p className="mt-1 text-sm">New governance actions are paused. Queued actions can still expire or be cancelled.</p>
        </div>
      )}

      {state.guardian && (state.canPause || state.canUnpause || state.canCancel) && (
        <div className="rounded-xl border border-slate-700 bg-[#151b2b] p-5">
          <h2 className="font-semibold text-slate-100">Guardian emergency actions</h2>
          {!wallet?.address ? (
            <p className="mt-2 text-sm text-slate-300">Connect the configured Guardian wallet to use emergency controls.</p>
          ) : !isGuardian ? (
            <p className="mt-2 text-sm text-amber-200">Only the configured Guardian wallet can submit pause or cancellation transactions. This wallet is not authorized.</p>
          ) : !networkReady ? (
            <p className="mt-2 text-sm text-amber-200">Switch your wallet to the configured Stellar network before submitting an emergency action.</p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              {(state.canPause || state.canCancel) && (
                <label className="block">
                  Public reason hash (SHA-256, 64 hex characters)
                  <input aria-label="Reason hash" value={reasonHash} onChange={(event) => setReasonHash(event.target.value)} maxLength={64} pattern="[0-9a-fA-F]{64}" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-mono text-slate-100" />
                </label>
              )}
              {state.canPause && !state.paused && (
                <div className="flex flex-wrap items-end gap-3">
                  <label>
                    Pause duration (ledgers)
                    <input aria-label="Pause duration in ledgers" type="number" min="1" max="4294967295" value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1 block w-48 rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100" />
                  </label>
                  <AppButton tone="danger" disabled={busy || !/^[0-9a-fA-F]{64}$/.test(reasonHash) || !Number.isSafeInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 0xffffffff} onClick={() => void submit({ kind: "pause", durationLedgers: Number(duration), reasonHash })}>
                    Pause community
                  </AppButton>
                </div>
              )}
              {state.canUnpause && state.paused && (
                <AppButton tone="secondary" disabled={busy} onClick={() => void submit({ kind: "unpause" })}>
                  Unpause community
                </AppButton>
              )}
              {state.canCancel && (
                <div className="space-y-2 border-t border-slate-700 pt-4">
                  <label className="block">
                    Queued action ID (64 hex characters)
                    <input aria-label="Queued action ID" value={actionId} onChange={(event) => setActionId(event.target.value)} maxLength={64} pattern="[0-9a-fA-F]{64}" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 font-mono text-slate-100" />
                  </label>
                  <AppButton tone="danger" disabled={busy || !/^[0-9a-fA-F]{64}$/.test(actionId) || !/^[0-9a-fA-F]{64}$/.test(reasonHash)} onClick={() => void submit({ kind: "cancel", actionId, reasonHash })}>
                    Cancel queued action
                  </AppButton>
                </div>
              )}
            </div>
          )}
          <p role="status" className="mt-3 text-sm text-slate-200">{message}</p>
        </div>
      )}
    </section>
  );
}
