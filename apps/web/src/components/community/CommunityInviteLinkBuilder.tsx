"use client";

import { useEffect, useState } from "react";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { buildCommunityInviteUrl } from "@/lib/community/invite";

const COPY_FEEDBACK_MS = 2000;

export interface CommunityInviteLinkBuilderProps {
  communityId: string;
  className?: string;
}

/**
 * Shareable invite link builder, shown on deploy success and on the
 * community settings page (issue #407). Builds a plain `?invite=1` link —
 * see lib/community/invite.ts for why this is never a signed/privileged
 * token.
 */
export function CommunityInviteLinkBuilder({ communityId, className }: CommunityInviteLinkBuilderProps) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Deferred a microtask so this never lands synchronously within the
    // effect itself (react-hooks/set-state-in-effect).
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!origin) return null;

  const inviteUrl = buildCommunityInviteUrl(communityId, origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-950/50 p-3 ${className ?? ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Invite link</p>
      <p className="mt-1 text-xs text-slate-500">
        Shares this community with a &quot;You&apos;ve been invited&quot; banner. Never grants owner or guardian
        powers — ownership is still verified on-chain.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          readOnly
          value={inviteUrl}
          aria-label="Community invite link"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-200"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-11 shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <LiveStatus className="sr-only">{copied ? "Invite link copied to clipboard." : ""}</LiveStatus>
    </div>
  );
}
