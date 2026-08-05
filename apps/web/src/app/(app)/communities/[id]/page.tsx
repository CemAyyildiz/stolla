"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCommunity } from "@/lib/community/registry";
import { resolveCommunityResourceUrl } from "@/lib/community/schema";
import type {
  CommunityDetailResult,
  CommunityRegistryRecord,
} from "@/lib/community/types";
import {
  buildStellarExplorerContractUrl,
  resolveStellarNetworkId,
} from "@/lib/stellarExplorer";
import { truncateMiddle } from "@/lib/truncate";

function ContractAddress({
  label,
  record,
  contractId,
  onCopy,
}: {
  label: string;
  record: CommunityRegistryRecord;
  contractId: string;
  onCopy: (label: string, contractId: string) => void;
}) {
  const explorerUrl = buildStellarExplorerContractUrl(
    contractId,
    resolveStellarNetworkId(),
  );

  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-[#0b0f19] p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 min-w-0">
        <span
          className="block break-all font-mono text-sm text-slate-200"
          title={contractId}
        >
          {truncateMiddle(contractId, 12, 10)}
        </span>
        <span className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCopy(label, contractId)}
            className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            aria-label={`Copy full ${label.toLowerCase()} address`}
          >
            Copy address
          </button>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              aria-label={`View ${label.toLowerCase()} on Stellar Expert`}
            >
              Open explorer
            </a>
          )}
        </span>
      </dd>
      <span className="sr-only">Community {record.id}</span>
    </div>
  );
}

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const communityId = params.id;
  const [result, setResult] = useState<CommunityDetailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getCommunity(communityId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The community registry could not be reached.",
      );
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function copyAddress(label: string, address: string) {
    void navigator.clipboard.writeText(address).then(
      () => setCopyStatus(`${label} address copied.`),
      () => setCopyStatus(`Could not copy the ${label.toLowerCase()} address.`),
    );
  }

  if (loading && !result) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <LiveStatus className="sr-only">Loading community details…</LiveStatus>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <section
          role="alert"
          className="rounded-xl border border-rose-800/70 bg-rose-950/40 p-5"
        >
          <h1 className="text-xl font-semibold text-rose-100">
            Community could not be loaded
          </h1>
          <p className="mt-2 break-words text-sm text-rose-200 [overflow-wrap:anywhere]">
            {error}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-11 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60"
            >
              Retry community request
            </button>
            <Link
              href="/communities"
              className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to communities
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!result || result.status === "not-found") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-6">
          <h1 className="text-xl font-semibold text-slate-100">
            Community not found
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This ID is malformed or is not present in the canonical registry.
          </p>
          <Link
            href="/communities"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Browse communities
          </Link>
        </section>
      </div>
    );
  }

  if (result.status === "malformed") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <section
          role="alert"
          className="rounded-xl border border-amber-800/70 bg-amber-950/40 p-6"
        >
          <h1 className="text-xl font-semibold text-amber-100">
            Community record is malformed
          </h1>
          <p className="mt-2 text-sm text-amber-200">{result.message}</p>
          <Link
            href="/communities"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/50"
          >
            Back to communities
          </Link>
        </section>
      </div>
    );
  }

  const { community } = result;
  const { metadata, metadataError, record, governance } = community;
  const name = metadata?.name ?? `Community ${truncateMiddle(record.id, 8, 6)}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <Link
        href="/communities"
        className="text-sm text-indigo-300 hover:text-indigo-200"
      >
        ← All communities
      </Link>

      <header className="mt-5 flex min-w-0 items-start gap-4">
        {metadata?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveCommunityResourceUrl(metadata.logo)}
            alt={`${name} logo`}
            className="h-16 w-16 shrink-0 rounded-xl border border-slate-700 bg-slate-900 object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-indigo-950 text-2xl font-semibold text-indigo-300 sm:h-20 sm:w-20"
          >
            {metadata?.name.trim().charAt(0).toUpperCase() || "C"}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-slate-100 [overflow-wrap:anywhere] sm:text-3xl">
            {name}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {record.id}
          </p>
        </div>
      </header>

      {metadata ? (
        <p className="mt-6 break-words leading-7 text-slate-300 [overflow-wrap:anywhere]">
          {metadata.description}
        </p>
      ) : (
        <section
          role="status"
          className="mt-6 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4"
        >
          <h2 className="font-semibold text-amber-100">
            Community metadata is unavailable
          </h2>
          <p className="mt-1 break-words text-sm text-amber-200 [overflow-wrap:anywhere]">
            {metadataError} The verified on-chain registry details remain
            available below.
          </p>
        </section>
      )}

      {metadata && metadata.externalLinks.length > 0 && (
        <nav aria-label="Community links" className="mt-5 flex flex-wrap gap-2">
          {metadata.externalLinks.map((link) => (
            <a
              key={`${link.label}:${link.url}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/proposals?community=${record.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          View community proposals
        </Link>
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Membership actions
        </Link>
      </div>

      <section
        aria-labelledby="contracts-title"
        className="mt-8 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="contracts-title" className="font-semibold text-slate-100">
          Deployed contracts
        </h2>
        <dl className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
          <ContractAddress
            label="NFT contract"
            record={record}
            contractId={record.nftContract}
            onCopy={copyAddress}
          />
          <ContractAddress
            label="Governor contract"
            record={record}
            contractId={record.governorContract}
            onCopy={copyAddress}
          />
        </dl>
        <LiveStatus className="mt-3 text-sm text-slate-400">
          {copyStatus}
        </LiveStatus>
      </section>

      <section
        aria-labelledby="governance-title"
        className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="governance-title" className="font-semibold text-slate-100">
          Governance configuration
        </h2>
        {governance.unavailableFields.length > 0 && (
          <LiveStatus className="mt-3 rounded-lg border border-amber-800/70 bg-amber-950/40 p-3 text-sm text-amber-200">
            Some Governor reads failed:{" "}
            {governance.unavailableFields.join(", ")}. Available values remain
            visible.
          </LiveStatus>
        )}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">
              Proposal threshold (NFT votes)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.proposalThreshold ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Quorum (NFT votes)</dt>
            <dd className="mt-1 text-slate-100">
              {governance.quorum ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">
              Voting delay (Stellar ledgers)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.votingDelay ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">
              Voting period (Stellar ledgers)
            </dt>
            <dd className="mt-1 text-slate-100">
              {governance.votingPeriod ?? "Unavailable"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Ledger durations are authoritative. Wall-clock conversions are only
          estimates.
        </p>
      </section>

      <section
        aria-labelledby="registry-title"
        className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6"
      >
        <h2 id="registry-title" className="font-semibold text-slate-100">
          Registry provenance
        </h2>
        <dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-slate-500">Created at ledger</dt>
            <dd className="mt-1 text-slate-200">{record.createdAtLedger}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Creation index</dt>
            <dd className="mt-1 text-slate-200">{record.creationIndex}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Community owner</dt>
            <dd
              title={record.communityOwner}
              className="mt-1 break-all font-mono text-slate-200"
            >
              {truncateMiddle(record.communityOwner, 10, 8)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Metadata URI</dt>
            <dd
              title={record.metadataUri}
              className="mt-1 break-all font-mono text-slate-200"
            >
              {record.metadataUri}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
