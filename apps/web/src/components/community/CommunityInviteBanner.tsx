"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useWallet } from "@/context/WalletProvider";

export interface CommunityInviteBannerProps {
  /** Display name for the invited community, or null while metadata is still loading. */
  communityName: string | null;
}

/**
 * "You've been invited" banner shown on a community detail page when its
 * URL carries the `?invite=1` intent (see lib/community/invite.ts).
 *
 * This banner is purely informational. It reads no authorization state and
 * writes none: dismissing it only changes local component state, never the
 * URL, so the same invite link keeps working for the next visit or for
 * anyone else it's shared with. Its CTA is the ordinary wallet-connect
 * action already used elsewhere in the app (Header.tsx) — the invite flag
 * does not unlock, bypass, or pre-authorize anything.
 */
export function CommunityInviteBanner({ communityName }: CommunityInviteBannerProps) {
  const { address, connect, isConnecting } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section
      role="status"
      aria-label="Community invite"
      className="mb-5 rounded-xl border border-indigo-700/70 bg-indigo-950/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-indigo-100">
            You&apos;ve been invited{communityName ? ` to ${communityName}` : ""}
          </p>
          <p className="mt-1 text-sm text-indigo-200">
            {address
              ? "Your wallet is connected — browse this community's governance and proposals below."
              : "Connect your wallet to participate in this community."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss invite banner"
          className="min-h-11 min-w-11 shrink-0 rounded-lg border border-indigo-700 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-900/60"
        >
          Dismiss
        </button>
      </div>
      {!address && (
        <AppButton type="button" tone="primary" className="mt-3" onClick={() => void connect()} disabled={isConnecting}>
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </AppButton>
      )}
    </section>
  );
}
