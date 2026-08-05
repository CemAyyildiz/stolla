"use client";

import { useParams } from "next/navigation";
import { CommunityDetailView } from "@/components/community/CommunityDetailView";

export default function CommunityDetailPage() {
  const params = useParams<{ communityId: string }>();
  return <CommunityDetailView communityId={params.communityId} />;
}
