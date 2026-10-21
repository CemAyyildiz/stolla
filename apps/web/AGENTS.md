# Stolla Web App — Agent Guide

## Landing page (read first)

Before editing `/`, read **`docs/landing-page.md`**.

The landing page uses a **professional light** enterprise SaaS design. It is separate from the app dashboard. Key rules:

- Section order: Hero → Features → Showcase → How it works → Technology → FAQ → CTA
- Landing header has section anchor nav + "Enter app", not app tabs
- Use `landing.css` tokens (`.lp-*`, `.landing-*`) under `.landing-root`. Restrained, no decorative gradients or animated marquees.
- No em dashes in landing copy.

## App routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing (route group `(landing)`) |
| `/community` | NFT collection, mint form |
| `/community/[communityId]` | Community detail, resolved from the registry (`lib/communities/registry.ts`) |
| `/community/[communityId]/proposals` | Proposals scoped to that community's Governor contract |
| `/community/[communityId]/proposals/[proposalId]` | Single scoped proposal detail |
| `/proposals` | Proposal list and voting |

Multi-community discovery uses the typed `CommunityRegistry` adapter in
`lib/community/types.ts`. Production uses the CommunityFactory-backed adapter
from `lib/community/registry.ts`; tests inject deterministic adapters through
`CommunityRegistryProvider` or component props so they never need RPC access.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4
- `@stellar/stellar-sdk` + `@creit.tech/stellar-wallets-kit`
- Contract IDs in `NEXT_PUBLIC_*` env vars — see `lib/stellar.ts`

## Loading states

Every data region uses the shared skeleton pattern in
`components/ui/Skeleton.tsx`:

- `Skeleton` — the base placeholder. `variant="shimmer"` marks an active
  load; `variant="pulse"` is the calmer default. Both are `motion-safe:`, so
  reduced-motion users keep a static, still-visible placeholder.
- `SkeletonStat` — a labeled row for `<dl>` stats. Keep the label visible
  ("Name", "Symbol", …) so the loaded layout does not jump into unlabeled
  blocks.
- `SkeletonCommunityRow` / `SkeletonProposalRow` — list row chrome that
  mirrors `CommunityCard` / `ProposalSummaryCard`.

The skeleton fill (`.skeleton-fill` in `globals.css`) is lighter than the
card surface on purpose: a placeholder must never be mistaken for a disabled
form field, which is always darker than its surface.

Each loading panel owns exactly **one** `role="status"` region (use
`LiveStatus`). Two live regions announcing the same load make screen readers
repeat themselves and read as broken.

## Next.js note

This project may use a newer Next.js than your training data. Check `node_modules/next/dist/docs/` for API changes if builds fail.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
