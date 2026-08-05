"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProposalDetailPage from "@/app/(app)/proposals/[id]/page";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { getCommunity } from "@/lib/community/registry";
import type { CommunityView } from "@/lib/community/types";
import { parseProposalId } from "@/lib/proposals";

function isContractId(value: string) {
  return /^C[A-Z2-7]{55}$/.test(value);
}

export default function CommunityProposalDetailPage() {
  const { id = "", proposalId = "" } = useParams<{
    id: string;
    proposalId: string;
  }>();
  const [community, setCommunity] = useState<CommunityView | null>(null);
  const [status, setStatus] = useState<
    "loading" | "community-not-found" | "invalid-contracts" | "error"
  >("loading");

  useEffect(() => {
    let active = true;
    setCommunity(null);
    setStatus("loading");
    void getCommunity(id)
      .then((result) => {
        if (!active) return;
        if (result.status !== "found") {
          setStatus("community-not-found");
          return;
        }
        if (
          !isContractId(result.community.record.governorContract) ||
          !isContractId(result.community.record.nftContract)
        ) {
          setStatus("invalid-contracts");
          return;
        }
        setCommunity(result.community);
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (community) {
    return (
      <ProposalDetailPage proposalId={proposalId} community={community} />
    );
  }

  const invalidProposal = parseProposalId(proposalId) === null;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {status === "loading" ? (
        <LiveStatus>Loading community proposal…</LiveStatus>
      ) : (
        <section
          role={status === "error" || status === "invalid-contracts" ? "alert" : undefined}
          className="rounded-xl border border-slate-800 bg-[#151b2b] p-6"
        >
          <h1 className="text-xl font-semibold text-slate-100">
            {status === "community-not-found"
              ? "Community not found"
              : status === "invalid-contracts"
                ? "Community contracts are invalid"
                : "Community proposal unavailable"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {status === "community-not-found"
              ? "The route community is malformed or is not registered."
              : status === "invalid-contracts"
                ? "The registry record does not contain valid NFT and Governor contract addresses."
                : invalidProposal
                  ? "The proposal identifier is malformed."
                  : "The canonical community record could not be loaded."}
          </p>
          <Link
            href={
              status === "community-not-found"
                ? "/communities"
                : `/communities/${id}/proposals`
            }
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white"
          >
            {status === "community-not-found"
              ? "Browse communities"
              : "Back to community proposals"}
          </Link>
        </section>
      )}
    </div>
  );
}
