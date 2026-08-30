import type { CommunityDeploymentAdapter } from "@/lib/community/deployment";
import type {
  CommunityRegistry,
  CommunityRegistryPage,
} from "@/lib/community/types";

export type E2EProposal = {
  id: string;
  description: string | null;
  state?: number;
};

export type StollaE2EBridge = {
  wallet?: {
    address: string;
    networkPassphrase: string;
    rejected?: boolean;
  };
  communities?: CommunityRegistryPage["communities"];
  proposals?: Record<string, E2EProposal[]>;
  deployment?: CommunityDeploymentAdapter;
  diagnostics?: {
    submissions: number;
    invocations: unknown[];
  };
};

declare global {
  interface Window {
    __STOLLA_E2E__?: StollaE2EBridge;
  }
}

export function e2eMocksEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_E2E_MOCKS !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return (
    typeof window !== "undefined" && window.location.hostname === "127.0.0.1"
  );
}

export function getE2EBridge(): StollaE2EBridge | null {
  if (typeof window === "undefined" || !e2eMocksEnabled()) return null;
  return window.__STOLLA_E2E__ ?? null;
}

export function getE2ECommunityRegistry(): CommunityRegistry | null {
  const communities = getE2EBridge()?.communities;
  if (!communities) return null;
  return {
    async list(cursor, limit) {
      const start = cursor ?? 0;
      const page = communities.slice(start, start + limit);
      const nextCursor =
        start + page.length < communities.length
          ? start + page.length
          : null;
      return { communities: page, nextCursor, malformedRecords: 0 };
    },
    async get(id) {
      const community = communities.find(
        (candidate) => candidate.record.id.toLowerCase() === id.toLowerCase(),
      );
      return community
        ? { status: "found", community }
        : { status: "not-found" };
    },
  };
}
