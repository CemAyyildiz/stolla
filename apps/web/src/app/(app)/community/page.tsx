"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  createNftClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { contractIds } from "@/lib/stellar";
import {
  loadCommunityData,
  runCommunityRefresh,
} from "./community-data.mjs";

export default function CommunityPage() {
  const { address, signTransaction } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [votes, setVotes] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tokenUri, setTokenUri] = useState("ipfs://");
  const [transactionStatus, setTransactionStatus] = useState<string | null>(
    null,
  );
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const contractsConfigured = Boolean(contractIds.nft);

  const refresh = useCallback(async () => {
    if (!contractsConfigured) return false;

    return runCommunityRefresh(
      () =>
        loadCommunityData({
          address,
          collectionClient: createReadOnlyNftClient(),
          userClient: address
            ? createNftClient({ publicKey: address, signTransaction })
            : null,
        }),
      {
        onStart() {
          setRefreshing(true);
          setDataLoadError(null);
        },
        onSuccess(data) {
          setName(data.name);
          setSymbol(data.symbol);
          setBalance(data.balance);
          setVotes(data.votes);
          setRefreshing(false);
        },
        onError(message) {
          setDataLoadError(message);
          setRefreshing(false);
        },
      },
    );
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleMint() {
    if (!address) {
      setTransactionStatus("Connect your wallet first.");
      return;
    }
    if (!recipient || !tokenUri) {
      setTransactionStatus("Recipient and IPFS URI are required.");
      return;
    }

    setLoading(true);
    setTransactionStatus(null);
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.mint({ to: recipient, token_uri: tokenUri });
      const result = await tx.signAndSend();
      setTransactionStatus(`Minted token #${result.result} successfully.`);
      await refresh();
    } catch (error: unknown) {
      setTransactionStatus(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelegate() {
    if (!address) {
      setTransactionStatus("Connect your wallet first.");
      return;
    }

    setLoading(true);
    setTransactionStatus(null);
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.delegate({
        account: address,
        delegatee: address,
      });
      await tx.signAndSend();
      setTransactionStatus("Delegated voting power to yourself.");
      await refresh();
    } catch (error: unknown) {
      setTransactionStatus(
        error instanceof Error ? error.message : "Delegate failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Community NFT</h1>
      <p className="mt-2 text-slate-400">
        Mint membership NFTs and delegate voting power on testnet.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200">
          Contract IDs are not set. Deploy contracts and configure{" "}
          <code className="font-mono">NEXT_PUBLIC_NFT_CONTRACT_ID</code> in{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      )}

      {contractsConfigured && (
        <div className="mt-6 space-y-6">
          {dataLoadError && (
            <section
              aria-labelledby="community-data-error-title"
              className="rounded-xl border border-rose-800/70 bg-rose-950/40 p-5"
              role="alert"
            >
              <h2
                className="font-semibold text-rose-100"
                id="community-data-error-title"
              >
                Community data could not be loaded
              </h2>
              <p className="mt-2 text-sm text-rose-200">{dataLoadError}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="mt-4 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-50"
              >
                {refreshing ? "Retrying..." : "Retry loading community data"}
              </button>
            </section>
          )}

          {refreshing && (
            <p className="text-sm text-slate-400" role="status" aria-live="polite">
              Loading community data...
            </p>
          )}

          <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-5">
            <h2 className="font-semibold text-slate-100">Collection</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd>{name || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Symbol</dt>
                <dd>{symbol || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Your balance</dt>
                <dd>{balance ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Your votes</dt>
                <dd>{votes ?? "—"}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleDelegate}
              disabled={!address || loading}
              className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Delegate to self
            </button>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-5">
            <h2 className="font-semibold text-slate-100">Mint NFT (owner only)</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-400">Recipient address</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="G..."
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">IPFS metadata URI</span>
                <input
                  value={tokenUri}
                  onChange={(e) => setTokenUri(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                />
              </label>
              <button
                type="button"
                onClick={handleMint}
                disabled={!address || loading}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Mint NFT"}
              </button>
            </div>
          </section>
        </div>
      )}

      {transactionStatus && (
        <p
          className="mt-4 rounded-lg border border-slate-800 bg-[#151b2b] p-3 text-sm text-slate-200"
          role="status"
        >
          {transactionStatus}
        </p>
      )}
    </div>
  );
}
