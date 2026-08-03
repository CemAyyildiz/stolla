"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  createNftClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { LiveStatus } from "@/components/ui/LiveStatus";

type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

export default function CommunityPage() {
  const { address, signTransaction } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [votes, setVotes] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tokenUri, setTokenUri] = useState("ipfs://");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [tokenUriError, setTokenUriError] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(contractIds.nft));

  const contractsConfigured = Boolean(contractIds.nft);

  const fetchRef = useRef(0);

  useEffect(() => {
    if (!contractsConfigured) return;

    const id = ++fetchRef.current;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const client = createReadOnlyNftClient();
        const [collectionName, collectionSymbol] = await Promise.all([
          client.name(),
          client.symbol(),
        ]);
        if (cancelled || fetchRef.current !== id) return;
        setName(collectionName.result ?? "");
        setSymbol(collectionSymbol.result ?? "");

        if (address) {
          const userClient = createNftClient({ publicKey: address, signTransaction });
          const [bal, votePower] = await Promise.all([
            userClient.balance({ account: address }),
            userClient.get_votes({ account: address }),
          ]);
          if (cancelled || fetchRef.current !== id) return;
          setBalance(Number(bal.result ?? 0));
          setVotes(String(votePower.result ?? 0));
        } else {
          setBalance(null);
          setVotes(null);
        }
      } finally {
        if (!cancelled && fetchRef.current === id) {
          setInitialLoading(false);
        }
      }
    };

    fetchData().catch((error: unknown) => {
      if (!cancelled) {
        setStatus({
          message:
            error instanceof Error ? error.message : "Failed to load NFT data",
          tone: "error",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address, contractsConfigured, signTransaction]);

  async function refresh() {
    if (!contractsConfigured) return;

    try {
      const client = createReadOnlyNftClient();
      const [collectionName, collectionSymbol] = await Promise.all([
        client.name(),
        client.symbol(),
      ]);
      setName(collectionName.result ?? "");
      setSymbol(collectionSymbol.result ?? "");

      if (address) {
        const userClient = createNftClient({ publicKey: address, signTransaction });
        const [bal, votePower] = await Promise.all([
          userClient.balance({ account: address }),
          userClient.get_votes({ account: address }),
        ]);
        setBalance(Number(bal.result ?? 0));
        setVotes(String(votePower.result ?? 0));
      } else {
        setBalance(null);
        setVotes(null);
      }
    } catch (error: unknown) {
      setStatus({
        message:
          error instanceof Error ? error.message : "Failed to load NFT data",
        tone: "error",
      });
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleMint() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    if (!recipient || !tokenUri) {
      setRecipientError(!recipient ? "Recipient address is required." : null);
      setTokenUriError(!tokenUri ? "IPFS metadata URI is required." : null);
      setStatus(null);
      return;
    }

    setRecipientError(null);
    setTokenUriError(null);
    setLoading(true);
    setStatus({ message: "Submitting mint transaction…", tone: "routine" });
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.mint({ to: recipient, token_uri: tokenUri });
      const result = await tx.signAndSend();
      setStatus({
        message: `Minted token #${result.result} successfully.`,
        tone: "routine",
      });
      await refresh();
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : "Mint failed",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelegate() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }

    setLoading(true);
    setStatus({
      message: "Submitting delegation transaction…",
      tone: "routine",
    });
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.delegate({
        account: address,
        delegatee: address,
      });
      await tx.signAndSend();
      setStatus({
        message: "Delegated voting power to yourself.",
        tone: "routine",
      });
      await refresh();
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : "Delegate failed",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Community NFT</h1>
      <p className="mt-2 text-slate-400">
        Mint membership NFTs and delegate voting power on testnet.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 break-words rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200 [overflow-wrap:anywhere]">
          Contract IDs are not set. Deploy contracts and configure{" "}
          <code className="font-mono">NEXT_PUBLIC_NFT_CONTRACT_ID</code> in{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      )}

      {contractsConfigured && (
        <div className="mt-6 space-y-6">
          {initialLoading ? (
            <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-5">
              <LiveStatus className="sr-only">
                Loading community data…
              </LiveStatus>
              <h2 className="font-semibold text-slate-100">Collection</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-32" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Symbol</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-20" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your balance</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-16" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your votes</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-24" /></dd>
                </div>
              </dl>
              <Skeleton className="mt-4 h-9 w-36 rounded-lg" />
            </section>
          ) : (
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
          )}

          <section className="min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
            <h2 className="font-semibold text-slate-100">Mint NFT (owner only)</h2>
            <div className="mt-4 min-w-0 space-y-4">
              <div>
                <label
                  htmlFor="recipient-address"
                  className="block break-words text-sm text-slate-400"
                >
                  Recipient address{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="recipient-address"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setRecipientError(null);
                  }}
                  type="text"
                  required
                  aria-describedby={`recipient-address-help${
                    recipientError ? " recipient-address-error" : ""
                  }`}
                  aria-invalid={Boolean(recipientError)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1 block min-h-11 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="G..."
                />
                <p
                  id="recipient-address-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Enter the recipient&apos;s Stellar public key, beginning with
                  G. Long addresses scroll within the field.
                </p>
                {recipientError && (
                  <p
                    id="recipient-address-error"
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {recipientError}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="token-uri"
                  className="block break-words text-sm text-slate-400"
                >
                  IPFS metadata URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="token-uri"
                  value={tokenUri}
                  onChange={(e) => {
                    setTokenUri(e.target.value);
                    setTokenUriError(null);
                  }}
                  type="text"
                  required
                  aria-describedby={`token-uri-help${
                    tokenUriError ? " token-uri-error" : ""
                  }`}
                  aria-invalid={Boolean(tokenUriError)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1 block min-h-11 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                />
                <p id="token-uri-help" className="mt-1 text-xs text-slate-500">
                  Use an IPFS URI such as ipfs://collection/member.json. Long
                  URIs scroll within the field.
                </p>
                {tokenUriError && (
                  <p
                    id="token-uri-error"
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {tokenUriError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleMint}
                disabled={!address || loading}
                className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 sm:w-auto"
              >
                {loading ? "Submitting..." : "Mint NFT"}
              </button>
            </div>
          </section>
        </div>
      )}

      {status && (
        <LiveStatus
          tone={status.tone}
          className={`mt-4 break-words rounded-lg border bg-[#151b2b] p-3 text-sm [overflow-wrap:anywhere] ${
            status.tone === "error"
              ? "border-rose-800/70 text-rose-200"
              : "border-slate-800 text-slate-200"
          }`}
        >
          {status.message}
        </LiveStatus>
      )}
    </div>
  );
}
