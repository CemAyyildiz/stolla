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
- Playwright — `npm run test:e2e --workspace=web`

## End-to-end tests

`e2e/` runs the community creation flow against a dev server, at desktop and
mobile widths. Nothing touches a real wallet or network:

- **Wallet** — `src/testing/mockWalletModule.ts` implements the wallets kit
  `ModuleInterface` and signs with a fixed key, so signatures are real and bound
  to the network passphrase the application asked for. Playwright steers it
  through `window.__stollaMockWallet`.
- **RPC** — `e2e/fixtures/sorobanRpc.ts` intercepts the JSON-RPC endpoint in the
  browser and answers with envelopes built by the SDK, so the app runs its
  normal parsing, assembly and polling paths. The configured RPC host is a
  `.invalid` domain, so anything that escapes interception fails loudly.

The mock wallet is gated twice and fails closed: the dynamic import is written
as a literal expression over build constants so production bundles drop the
chunk entirely, and `next.config.ts` refuses to build for production while
`NEXT_PUBLIC_E2E_WALLET` is set. Do not route that check through a shared
constant; it defeats dead-code elimination and the chunk ships again.

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
