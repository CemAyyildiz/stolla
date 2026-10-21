"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { activeNetwork } from "@/lib/stellar";
import { communityOwnership, validateNewOwner, type OwnershipSimulation } from "@/lib/community/ownership";
import type { CommunityRegistryRecord } from "@/lib/community/types";
import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";

type Props = { record: CommunityRegistryRecord; refresh: () => Promise<void> };

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|declin|denied/i.test(message)) return "Wallet approval was declined. Your destination is still saved here; review it and try again.";
  if (/auth|unauthorized/i.test(message)) return "This wallet is not authorized for that ownership step. Check the current and pending owners.";
  if (/expired|past ledger/i.test(message)) return "The transfer expired. The current owner must start a new transfer.";
  if (/fetch|network|rpc/i.test(message)) return "The Stellar network could not be reached. Check the wallet network and retry.";
  return message || "Ownership request failed. Review the address and retry.";
}

export function CommunityOwnershipSettings({ record, refresh }: Props) {
  const { address, signTransaction, walletNetworkPassphrase } = useWallet();
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [destination, setDestination] = useState("");
  const [simulation, setSimulation] = useState<OwnershipSimulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readVersion, setReadVersion] = useState(0);
  const correctNetwork = walletNetworkPassphrase === activeNetwork.networkPassphrase;

  useEffect(() => {
    let active = true;
    communityOwnership.readOwner(record.nftContract)
      .then((value) => { if (active) setOwner(value); })
      .catch(() => { if (active) setOwner(undefined); });
    return () => { active = false; };
  }, [record.nftContract, readVersion]);

  const isOwner = Boolean(address && owner === address);
  const destinationError = destination ? validateNewOwner(destination, owner ?? "") : null;

  async function run(action: () => Promise<void>) {
    if (busy || !address || !correctNetwork) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (cause) { setError(describeError(cause)); }
    finally { setBusy(false); }
  }

  async function refreshOwner() {
    setReadVersion((value) => value + 1);
    await refresh();
  }

  return (
    <section aria-labelledby="ownership-settings-title" className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6">
      <h2 id="ownership-settings-title" className="font-semibold text-slate-100">Community ownership settings</h2>
      <p className="mt-2 text-sm text-slate-400">NFT ownership controls minting. The recipient must accept the transfer before the registry can reflect the new owner. Governor settings remain governed by proposals.</p>
      <p className="mt-3 break-all text-xs text-slate-300">Current NFT owner: {owner === undefined ? "Unavailable; retry the read" : owner ?? "No owner"}</p>
      {record.communityOwner !== owner && owner && <p className="mt-2 text-sm text-amber-200">Registry owner differs from the NFT owner. Sync it after acceptance.</p>}
      {!address && <p className="mt-3 text-sm text-slate-400">Connect a wallet to manage ownership.</p>}
      {address && !correctNetwork && <p role="alert" className="mt-3 text-sm text-amber-200">Switch your wallet to the configured Stellar network.</p>}

      {isOwner && correctNetwork && <div className="mt-5 space-y-3">
        <label htmlFor="new-community-owner" className="block text-sm text-slate-200">New owner G address</label>
        <input id="new-community-owner" value={destination} onChange={(event) => { setDestination(event.target.value.trim()); setSimulation(null); setError(""); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100" placeholder="G..." />
        {destinationError && <p role="alert" className="text-sm text-rose-300">{destinationError}</p>}
        <AppButton disabled={busy || !destination || Boolean(destinationError)} onClick={() => void run(async () => {
          const next = await communityOwnership.simulate(record.nftContract, address!, destination, signTransaction);
          setSimulation(next);
        })}>Simulate transfer</AppButton>
        {simulation && <div className="space-y-3 rounded-lg border border-amber-800/70 bg-amber-950/20 p-3 text-sm text-amber-100">
          <p>Confirm new owner: <span className="break-all font-mono">{simulation.destination}</span></p>
          <p>The recipient must accept by ledger {simulation.deadline}. You keep mint authority until then.</p>
          <AppButton disabled={busy} onClick={() => void run(async () => {
            await communityOwnership.begin(simulation);
            setSimulation(null);
            setNotice(`Transfer started for ${simulation.destination}. Ask that address to accept it before ledger ${simulation.deadline}.`);
            await refreshOwner();
          })}>Confirm transfer in wallet</AppButton>
        </div>}
      </div>}

      {address && correctNetwork && <div className="mt-5 flex flex-wrap gap-3">
        {!isOwner && <AppButton disabled={busy} onClick={() => void run(async () => {
          await communityOwnership.accept(record.nftContract, address, signTransaction);
          setNotice("NFT ownership accepted. Updating the community registry…");
          setReadVersion((value) => value + 1);
          try {
            await communityOwnership.syncRegistry(record.id, address, signTransaction);
            await refreshOwner();
            setNotice("Ownership accepted and community details refreshed.");
          } catch (cause) {
            setError(`NFT ownership changed, but registry sync failed: ${describeError(cause)} Use Sync registry to retry.`);
          }
        })}>Accept pending NFT ownership</AppButton>}
        {owner && record.communityOwner !== owner && <AppButton disabled={busy} onClick={() => void run(async () => {
          await communityOwnership.syncRegistry(record.id, address, signTransaction);
          await refreshOwner();
          setNotice("Registry owner updated from the NFT contract.");
        })}>Sync registry owner</AppButton>}
      </div>}
      {owner === undefined && <AppButton className="mt-3" disabled={busy} onClick={() => setReadVersion((value) => value + 1)}>Retry owner read</AppButton>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-rose-300">{error}</p>}
      <LiveStatus className="mt-3 break-words text-sm text-emerald-300">{notice}</LiveStatus>
    </section>
  );
}
