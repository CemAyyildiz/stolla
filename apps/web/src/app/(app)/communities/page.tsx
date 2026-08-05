"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommunityCard } from "@/components/CommunityCard";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { listCommunities } from "@/lib/community/registry";
import type { CommunityView } from "@/lib/community/types";

const PAGE_SIZE = 9;

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunityView[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedRecords, setSkippedRecords] = useState(0);
  const requestSequence = useRef(0);
  const seenIds = useRef(new Set<string>());
  const nextCursorRef = useRef<number | null>(null);

  const loadPage = useCallback(
    async (replace: boolean) => {
      const sequence = ++requestSequence.current;
      const cursor = replace ? null : nextCursorRef.current;
      setLoading(true);
      setError(null);

      try {
        const page = await listCommunities(cursor, PAGE_SIZE);
        if (sequence !== requestSequence.current) return;
        if (page.nextCursor !== null && page.nextCursor === cursor) {
          throw new Error(
            "The registry returned the same cursor. Pagination stopped to prevent duplicate records.",
          );
        }

        if (replace) seenIds.current.clear();
        const unique = page.communities.filter((community) => {
          if (seenIds.current.has(community.record.id)) return false;
          seenIds.current.add(community.record.id);
          return true;
        });
        const duplicateCount = page.communities.length - unique.length;
        setSkippedRecords(
          (count) =>
            (replace ? 0 : count) +
            page.malformedRecords +
            duplicateCount,
        );
        setCommunities((current) =>
          replace ? unique : [...current, ...unique],
        );
        nextCursorRef.current = page.nextCursor;
        setNextCursor(page.nextCursor);
        setHasLoaded(true);
      } catch (cause) {
        if (sequence !== requestSequence.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The community registry could not be loaded.",
        );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPage(true), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPage]);

  const metadataFailureCount = communities.filter(
    (community) => community.metadataError,
  ).length;
  const governanceFailureCount = communities.filter(
    (community) => community.governance.unavailableFields.length > 0,
  ).length;
  const hasPartialData =
    skippedRecords > 0 ||
    metadataFailureCount > 0 ||
    governanceFailureCount > 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-100">Communities</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Discover public governance communities registered on Stellar. No
            wallet connection is required.
          </p>
        </div>
        <Link
          href="/communities/create"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Create a community
        </Link>
      </div>

      {hasPartialData && (
        <LiveStatus className="mt-6 rounded-lg border border-amber-800/70 bg-amber-950/40 p-4 text-sm text-amber-200">
          Some registry data is unavailable. Valid communities remain listed.
          {skippedRecords > 0
            ? ` ${skippedRecords} malformed or duplicate ${skippedRecords === 1 ? "record was" : "records were"} skipped.`
            : ""}
          {metadataFailureCount > 0
            ? ` Metadata failed for ${metadataFailureCount}.`
            : ""}
          {governanceFailureCount > 0
            ? ` Governance settings failed for ${governanceFailureCount}.`
            : ""}
        </LiveStatus>
      )}

      {loading && communities.length === 0 && (
        <>
          <LiveStatus className="sr-only">
            Loading registered communities…
          </LiveStatus>
          <ul
            className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            aria-hidden="true"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="rounded-xl border border-slate-800 bg-[#151b2b] p-5"
              >
                <div className="flex gap-3">
                  <Skeleton className="h-12 w-12" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="mt-5 h-16 w-full" />
                <Skeleton className="mt-5 h-20 w-full" />
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <section
          className="mt-6 rounded-xl border border-rose-800/70 bg-rose-950/40 p-5"
          role="alert"
          aria-labelledby="communities-error-title"
        >
          <h2
            id="communities-error-title"
            className="font-semibold text-rose-100"
          >
            Community registry is temporarily unavailable
          </h2>
          <p className="mt-2 break-words text-sm text-rose-200 [overflow-wrap:anywhere]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadPage(communities.length === 0)}
            disabled={loading}
            className="mt-4 min-h-11 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 disabled:opacity-50"
          >
            {loading ? "Retrying…" : "Retry registry request"}
          </button>
        </section>
      )}

      {!loading &&
        !error &&
        hasLoaded &&
        communities.length === 0 &&
        nextCursor === null && (
          <LiveStatus className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
            No communities are registered yet. You can prepare the first
            community without connecting a wallet.
          </LiveStatus>
        )}

      {communities.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {communities.map((community) => (
            <li key={community.record.id} className="min-w-0">
              <CommunityCard community={community} />
            </li>
          ))}
        </ul>
      )}

      {nextCursor !== null && !error && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadPage(false)}
            disabled={loading}
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-[#151b2b] px-5 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800/80 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Loading more…" : "Load more communities"}
          </button>
        </div>
      )}
    </div>
  );
}
