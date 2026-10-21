/**
 * Community invite URLs (issue #407).
 *
 * The invite intent is a plain, unsigned query flag — `?invite=1` — not a
 * signed token. This is a deliberate security choice, not a shortcut: the
 * flag is read in exactly one place (the invite banner, purely to decide
 * whether to show "You've been invited") and is never passed into, or
 * checked by, any authorization code path. A community's owner/guardian
 * gating (see CommunityOwnershipSettings.tsx, GuardianControls.tsx) reads
 * only the connected wallet address against on-chain state — this flag
 * cannot influence that even if an attacker or a stale/replayed link sets
 * it on an account that was never actually invited. There is nothing to
 * forge because the flag grants nothing.
 */

export const INVITE_QUERY_PARAM = "invite";
export const INVITE_QUERY_VALUE = "1";

/** Relative path for a community's invite link: `/communities/<id>?invite=1`. */
export function buildCommunityInvitePath(communityId: string): string {
  return `/communities/${encodeURIComponent(communityId)}?${INVITE_QUERY_PARAM}=${INVITE_QUERY_VALUE}`;
}

/**
 * Absolute invite URL for sharing outside the app. `origin` is the caller's
 * `window.location.origin` (or any other explicit origin) — this function
 * never reads `window` itself, so it stays usable from a unit test.
 */
export function buildCommunityInviteUrl(communityId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${buildCommunityInvitePath(communityId)}`;
}

/** True when the given query string carries the invite intent. */
export function hasInviteIntent(search: string): boolean {
  return new URLSearchParams(search).get(INVITE_QUERY_PARAM) === INVITE_QUERY_VALUE;
}
