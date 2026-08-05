"use client";

import { useParams } from "next/navigation";
import { CommunityProposalsView } from "@/components/community/CommunityProposalsView";

export default function CommunityProposalsPage() {
  const params = useParams<{ communityId: string }>();
  return <CommunityProposalsView communityId={params.communityId} />;
}
