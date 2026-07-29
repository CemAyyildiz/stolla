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
| `/community/new` | Community creation wizard |
| `/proposals` | Proposal list and voting |

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4
- `@stellar/stellar-sdk` + `@creit.tech/stellar-wallets-kit`
- Contract IDs in `NEXT_PUBLIC_*` env vars — see `lib/stellar.ts`
- Vitest + Testing Library — `npm run test --workspace=web`

## Networks

`lib/network.ts` owns the network registry. Two rules hold across the app:

- Anything network specific (a simulation, a submitted transaction) stores the
  passphrase it belongs to. Gates compare against that stored value, never
  against whatever is active at use time.
- Explorer URL builders take a network argument. There is no ambient default, so
  a link cannot outlive the network it was built for.

`useNetworkGuard()` compares the wallet network with `activeNetwork` and is the
only thing pages should read for mismatch decisions. `WalletProvider` re-reads
the wallet network on every signature and throws `NetworkMismatchError` before
handing over any XDR.

## Next.js note

This project may use a newer Next.js than your training data. Check `node_modules/next/dist/docs/` for API changes if builds fail.
