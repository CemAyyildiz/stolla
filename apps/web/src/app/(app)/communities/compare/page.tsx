"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CommunityAvatar } from "@/components/CommunityAvatar";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import {
  buildGovernanceComparisonRows,
  buildMetadataComparisonRows,
  parseCompareIds,
  type CompareRow,
} from "@/lib/community/compareGovernance";
import type { Community, CommunityDetailResult } from "@/lib/community/types";

type SlotState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "result"; result: CommunityDetailResult };

function slotCommunity(slot: SlotState | undefined): Community | null {
  return slot?.status === "result" && slot.result.status === "found"
    ? slot.result.community
    : null;
}

function slotStatusNote(slot: SlotState | undefined): string | null {
  if (!slot) return null;
  if (slot.status === "error") return slot.message;
  if (slot.status === "result") {
    if (slot.result.status === "not-found") {
      return "This ID is malformed or is not present in the canonical registry.";
    }
    if (slot.result.status === "malformed") {
      return slot.result.message;
    }
  }
  return null;
}

function SlotHeader({ id, slot }: { id: string; slot: SlotState | undefined }) {
  const community = slotCommunity(slot);
  const note = slotStatusNote(slot);

  return (
    <div className="min-w-0">
      {!slot || slot.status === "loading" ? (
        <div className="flex items-center gap-3">
          <Skeleton variant="shimmer" className="h-10 w-10 shrink-0 rounded-lg" />
          <Skeleton variant="shimmer" className="h-5 w-32" />
        </div>
      ) : community ? (
        <div className="flex min-w-0 items-center gap-3">
          <CommunityAvatar
            communityId={community.record.id}
            name={community.metadata?.name ?? community.record.id}
            logo={community.metadata?.logo}
            size="card"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100" title={community.metadata?.name}>
              {community.metadata?.name ?? "Untitled community"}
            </p>
            <Link
              href={`/communities/${community.record.id}`}
              className="text-xs text-indigo-300 hover:text-indigo-200"
            >
              View community
            </Link>
          </div>
        </div>
      ) : (
        <div role="alert" className="rounded-lg border border-amber-800/70 bg-amber-950/40 p-3">
          <p className="break-all font-mono text-xs text-amber-300" title={id}>
            {id}
          </p>
          <p className="mt-1 text-sm text-amber-200">{note ?? "This community could not be loaded."}</p>
        </div>
      )}
    </div>
  );
}

function CompareTable({ rows, title }: { rows: CompareRow[]; title: string }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6">
      <h2 className="font-semibold text-slate-100">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <caption className="sr-only">{title} comparison between two communities</caption>
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">
                Parameter
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Community A
              </th>
              <th scope="col" className="py-2 font-medium">
                Community B
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-slate-800/60 ${row.differs ? "bg-amber-950/20" : ""}`}
              >
                <th scope="row" className="py-2 pr-3 font-normal text-slate-400">
                  {row.label}
                  {row.helper ? (
                    <span className="block text-xs text-slate-600">{row.helper}</span>
                  ) : null}
                </th>
                <td className="py-2 pr-3 text-slate-100">
                  {row.a.text ?? <span className="text-slate-600">Unavailable</span>}
                </td>
                <td className="py-2 text-slate-100">
                  {row.differs ? (
                    <span className="inline-flex items-center gap-1.5">
                      {row.b.text}
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Differs
                      </span>
                    </span>
                  ) : (
                    (row.b.text ?? <span className="text-slate-600">Unavailable</span>)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CommunitiesComparePage() {
  const registry = useCommunityRegistry();
  const [ids, setIds] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<SlotState[]>([]);

  // Query params are read client-side (not via useSearchParams) to match
  // this app's existing convention for URL-driven pages (see
  // communities/page.tsx's readListUrlState). Deferred a microtask so the
  // state write never lands synchronously within the effect itself.
  useEffect(() => {
    queueMicrotask(() => {
      setIds(parseCompareIds(new URLSearchParams(window.location.search).get("ids")));
    });
  }, []);

  useEffect(() => {
    if (!ids || ids.length !== 2) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setSlots(ids.map(() => ({ status: "loading" })));
    });

    ids.forEach((id, index) => {
      registry
        .get(id)
        .then((result) => {
          if (!active) return;
          setSlots((previous) => {
            const next = [...previous];
            next[index] = { status: "result", result };
            return next;
          });
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setSlots((previous) => {
            const next = [...previous];
            next[index] = {
              status: "error",
              message: cause instanceof Error ? cause.message : "The community registry could not be reached.",
            };
            return next;
          });
        });
    });

    return () => {
      active = false;
    };
  }, [ids, registry]);

  if (ids === null) {
    return <div className="mx-auto w-full max-w-4xl px-4 py-10" aria-busy="true" />;
  }

  if (ids.length !== 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <section role="alert" className="rounded-xl border border-rose-800/70 bg-rose-950/40 p-6">
          <h1 className="text-xl font-semibold text-rose-100">Compare needs exactly two community IDs</h1>
          <p className="mt-2 text-sm text-rose-200">
            {ids.length === 0
              ? "No community IDs were given."
              : `${ids.length} community IDs were given.`}{" "}
            Use <code className="font-mono">/communities/compare?ids=&lt;id-a&gt;,&lt;id-b&gt;</code>.
          </p>
          <AppLinkButton href="/communities" tone="primary" className="mt-4">
            Browse communities
          </AppLinkButton>
        </section>
      </div>
    );
  }

  const [idA, idB] = ids;
  const [slotA, slotB] = slots;
  const communityA = slotCommunity(slotA);
  const communityB = slotCommunity(slotB);
  const bothSettled =
    (!slotA || slotA.status !== "loading") && (!slotB || slotB.status !== "loading");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Compare communities</h1>
      <p className="mt-2 text-sm text-slate-400">
        Governance parameters and basic metadata for two registry communities, side by side.
      </p>

      <LiveStatus className="sr-only">
        {bothSettled ? "Community comparison loaded." : "Loading communities to compare…"}
      </LiveStatus>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SlotHeader id={idA} slot={slotA} />
        <SlotHeader id={idB} slot={slotB} />
      </div>

      {bothSettled ? (
        <>
          <CompareTable
            title="Metadata"
            rows={buildMetadataComparisonRows(
              communityA?.metadata ?? null,
              communityA?.record.createdAtLedger ?? null,
              communityB?.metadata ?? null,
              communityB?.record.createdAtLedger ?? null,
            )}
          />
          <CompareTable
            title="Governance configuration"
            rows={buildGovernanceComparisonRows(
              communityA?.governance ?? null,
              communityB?.governance ?? null,
            )}
          />
        </>
      ) : (
        <div className="mt-6 space-y-2" aria-hidden="true">
          <Skeleton variant="shimmer" className="h-32 w-full rounded-xl" />
          <Skeleton variant="shimmer" className="h-40 w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
