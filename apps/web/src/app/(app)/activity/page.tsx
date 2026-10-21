"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { loadActivityFeed, type ActivityFeed } from "@/lib/community/activityFeed";
import { formatProposalDeadlineEstimate } from "@/lib/proposalDeadline";
import { proposalTitle } from "@/lib/proposal-metadata/parse";
import { AppButton } from "@/components/ui/AppButton";

const voteLabels = ["Against", "For", "Abstain"];

function WalletActivity({ address }: { address: string }) {
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void loadActivityFeed(address).then((result) => {
      if (active) setFeed(result);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [address, refreshKey]);

  function retry() {
    setFeed(null);
    setError(false);
    setRefreshKey((key) => key + 1);
  }

  if (!feed && !error) return <p role="status" className="mt-6 text-slate-400">Loading your community activity…</p>;
  if (error || (feed?.registryIncomplete && feed.memberCount === 0 && feed.failures === 0)) {
    return <div role="alert" className="mt-6 rounded-xl border border-rose-800 p-4 text-rose-200">
      Community activity could not be loaded. <AppButton onClick={retry} tone="secondary">Retry</AppButton>
    </div>;
  }
  if (!feed) return null;

  return <>
    {(feed.failures > 0 || feed.registryIncomplete) && <div role="alert" className="mt-6 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
      Some community activity is unavailable. Results below may be incomplete. <AppButton onClick={retry} tone="secondary" className="ml-2">Retry</AppButton>
    </div>}
    {feed.memberCount === 0 ? <p className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-slate-300">
      {feed.failures > 0 || feed.registryIncomplete
        ? "Membership could not be fully checked. Retry to see all communities."
        : "No memberships found for this wallet."} <Link href="/communities" className="text-indigo-300 underline">Browse communities</Link>
    </p> : <>
      <section className="mt-8" aria-labelledby="open-votes-heading">
        <h2 id="open-votes-heading" className="text-lg font-semibold text-slate-100">Open votes</h2>
        {feed.proposals.length === 0 ? <p className="mt-3 text-slate-400">No open votes found in your communities.</p> : <ul className="mt-3 space-y-3">
          {feed.proposals.map((proposal) => {
            const name = proposal.community.metadata?.name ?? `Community ${proposal.community.record.id.slice(0, 8)}`;
            return <li key={`${proposal.community.record.id}:${proposal.id}`}>
              <Link href={`/community/${proposal.community.record.id}/proposals/${proposal.id}`} className="block rounded-xl border border-slate-800 bg-[#151b2b] p-4 hover:border-indigo-700">
                <span className="block text-sm text-indigo-300">{name} · Active</span>
                <span className="mt-1 block break-words font-medium text-slate-100">{proposalTitle(proposal.description) ?? `Proposal ${proposal.id.slice(0, 10)}…`}</span>
                <span className="mt-1 block text-sm text-slate-400">{formatProposalDeadlineEstimate(proposal.voteEnd, proposal.currentLedger, proposal.voteSnapshot) ?? `Voting ends at ledger ${proposal.voteEnd}`}</span>
              </Link>
            </li>;
          })}
        </ul>}
      </section>
      <section className="mt-8" aria-labelledby="recent-votes-heading">
        <h2 id="recent-votes-heading" className="text-lg font-semibold text-slate-100">Recent votes cast</h2>
        {feed.votes.length === 0 ? <p className="mt-3 text-slate-400">No recent votes found in your communities.</p> : <ul className="mt-3 space-y-3">
          {feed.votes.slice(0, 20).map((vote) => <li key={`${vote.community.record.id}:${vote.eventId}`}>
            <Link href={`/community/${vote.community.record.id}/proposals/${vote.id}`} className="block rounded-xl border border-slate-800 bg-[#151b2b] p-4 hover:border-indigo-700">
              <span className="block text-sm text-indigo-300">{vote.community.metadata?.name ?? `Community ${vote.community.record.id.slice(0, 8)}`}</span>
              <span className="mt-1 block text-slate-100">Voted {voteLabels[vote.voteType] ?? "Unknown"} on proposal {vote.id.slice(0, 10)}…</span>
              <span className="mt-1 block text-xs text-slate-400">Ledger {vote.ledger}</span>
            </Link>
          </li>)}</ul>}
        <p className="mt-3 text-xs text-slate-500">Recent votes reflect the available RPC event history.</p>
      </section>
    </>}
  </>;
}

export default function ActivityPage() {
  const { address, connect, isConnecting } = useWallet();
  // The (app) route group's layout already renders the page's single
  // <main id="main-content">, so this is a <div>, not a second <main> — see
  // #405.
  return <div className="mx-auto w-full max-w-3xl px-4 py-10">
    <h1 className="text-2xl font-bold text-slate-100">Your activity</h1>
    <p className="mt-2 text-slate-400">Open votes and recent actions across your communities.</p>
    {!address ? <div className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-5">
      <p className="text-slate-300">Connect your wallet to see activity in your communities.</p>
      <AppButton tone="primary" className="mt-3" onClick={() => void connect()} disabled={isConnecting}>{isConnecting ? "Connecting…" : "Connect wallet"}</AppButton>
    </div> : <WalletActivity key={address} address={address} />}
  </div>;
}
