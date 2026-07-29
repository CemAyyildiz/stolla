# Test support

Reusable test doubles for the web workspace. Nothing in this folder performs a
network request, and nothing here requires a wallet extension.

## Stellar RPC and contract mocks

`stellar/` provides configurable mocks for the community NFT and Governor
clients, plus transaction fixtures for simulation, signing, successful
submission and failure.

```ts
import {
  createGovernorClientMock,
  createNftClientMock,
  delayed,
  rejected,
  resetAllStellarMocks,
  resolved,
  MOCK_ACCOUNT_ALICE,
  MOCK_PROPOSAL_ID,
} from "@/test-support/stellar";
import { ProposalState } from "@/lib/bindings/community-governor/src";

const nft = createNftClientMock();
const governor = createGovernorClientMock();

// Reads
nft.set("balance", resolved(4));
nft.set("get_votes", resolved(BigInt(9)));
nft.set("get_total_supply", delayed(BigInt(12), 50)); // loading states
nft.set("owner_of", rejected("rpc unavailable")); // RPC failure

// Governance state, per proposal and per account
governor.setProposalState(MOCK_PROPOSAL_ID, ProposalState.Succeeded);
governor.setHasVoted(MOCK_PROPOSAL_ID, MOCK_ACCOUNT_ALICE, true);

// Assert what the component sent to the contract
const args = governor.cast_vote.lastArgs();

// Restore every mock between tests
resetAllStellarMocks();
```

### Transaction outcomes

```ts
governor.setTransactionOptions({ onSign: (req) => recorded.push(req.xdr) });
const tx = await governor.propose(input);
await tx.simulate();
const outcome = await tx.signAndSend(); // { status: "SUCCESS", hash, result }

governor.setTransactionOptions({ outcome: "failure" });
// -> { status: "FAILED", hash, error }
// setTransactionOptions({ outcome: "failure", rejectOnSubmit: true }) throws instead
```

## Why there is no `vi.fn()` here

`apps/web/tsconfig.json` type-checks every `.ts` file in the workspace, and the
workspace has no test runner installed yet. Importing `vitest` in this folder
would therefore break `npm run build --workspace=web`. The mocks use a small
internal call recorder (`callRecorder.ts`) instead, which also means they can be
reused from any runner.

`stellar/examples.ts` holds executable example scenarios with plain assertions;
`stellar/examples.test.ts` registers them with the runner's globals when one is
available, so the suite starts working the moment Vitest lands with
`globals: true` — no edits required.

## Typing

Value types mirror the generated bindings (`u32` → `number`, `u128` →
`bigint`, `Option<T>` → `T | undefined`, proposal ids → 32-byte `Buffer`), and
`proposal_state` uses the real `ProposalState` enum. A binding regeneration that
changes a return type surfaces as a compile error here rather than a silently
wrong fixture.

Note: `BigInt(1)` is used rather than `1n` because the workspace targets
ES2017.
