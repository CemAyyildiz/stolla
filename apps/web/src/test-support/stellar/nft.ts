import type { Option, u32, u128 } from "@stellar/stellar-sdk/contract";

import { createRecorder, type CallRecorder } from "./callRecorder";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_COLLECTION_NAME,
  MOCK_COLLECTION_SYMBOL,
  MOCK_TOKEN_URI,
} from "./fixtures";
import { registerMock } from "./registry";
import { resolved, type Responder } from "./responses";
import {
  createTransactionFixture,
  type MockAssembledTransaction,
  type TransactionFixtureOptions,
} from "./transactions";

export type NftAccountArgs = { account: string };
export type NftTokenArgs = { token_id: u32 };
export type NftMintArgs = { to: string; token_uri: string };
export type NftDelegateArgs = { account: string; delegatee: string };

/**
 * Response slots, one per mocked method. Names and value types mirror
 * `lib/bindings/community-nft`, so a binding regeneration that changes a return
 * type surfaces here as a type error rather than a silently wrong fixture.
 */
export type NftResponses = {
  name: Responder<string>;
  symbol: Responder<string>;
  balance: Responder<u32>;
  get_votes: Responder<u128>;
  get_total_supply: Responder<u128>;
  get_delegate: Responder<Option<string>>;
  owner_of: Responder<string>;
  token_uri: Responder<string>;
  mint: Responder<u32>;
  delegate: Responder<null>;
};

type Method<TArgs, TValue> = CallRecorder<
  TArgs,
  Promise<MockAssembledTransaction<TValue>>
>;

export type NftClientMock = {
  name: Method<void, string>;
  symbol: Method<void, string>;
  balance: Method<NftAccountArgs, u32>;
  get_votes: Method<NftAccountArgs, u128>;
  get_total_supply: Method<void, u128>;
  get_delegate: Method<NftAccountArgs, Option<string>>;
  owner_of: Method<NftTokenArgs, string>;
  token_uri: Method<NftTokenArgs, string>;
  mint: Method<NftMintArgs, u32>;
  delegate: Method<NftDelegateArgs, null>;
  /** Replaces one response slot. */
  set<K extends keyof NftResponses>(key: K, responder: NftResponses[K]): void;
  /** Applies transaction-level options (submission failure, signer, hash). */
  setTransactionOptions(options: TransactionFixtureOptions): void;
  reset(): void;
};

export function defaultNftResponses(): NftResponses {
  return {
    name: resolved(MOCK_COLLECTION_NAME),
    symbol: resolved(MOCK_COLLECTION_SYMBOL),
    balance: resolved(1),
    get_votes: resolved(BigInt(1)),
    get_total_supply: resolved(BigInt(3)),
    get_delegate: resolved<Option<string>>(MOCK_ACCOUNT_ALICE),
    owner_of: resolved(MOCK_ACCOUNT_ALICE),
    token_uri: resolved(MOCK_TOKEN_URI),
    mint: resolved(7),
    delegate: resolved(null),
  };
}

/**
 * Creates a mock of the community NFT client: collection reads, balance,
 * voting power, delegation and mint.
 */
export function createNftClientMock(
  overrides: Partial<NftResponses> = {},
): NftClientMock {
  const initialOverrides: Partial<NftResponses> = { ...overrides };

  let responses: NftResponses = {
    ...defaultNftResponses(),
    ...initialOverrides,
  };
  let txOptions: TransactionFixtureOptions = {};

  const name = createRecorder<void, Promise<MockAssembledTransaction<string>>>(
    async () => createTransactionFixture(await responses.name(), txOptions),
  );
  const symbol = createRecorder<void, Promise<MockAssembledTransaction<string>>>(
    async () => createTransactionFixture(await responses.symbol(), txOptions),
  );
  const balance = createRecorder<
    NftAccountArgs,
    Promise<MockAssembledTransaction<u32>>
  >(async () => createTransactionFixture(await responses.balance(), txOptions));
  const getVotes = createRecorder<
    NftAccountArgs,
    Promise<MockAssembledTransaction<u128>>
  >(async () =>
    createTransactionFixture(await responses.get_votes(), txOptions),
  );
  const getTotalSupply = createRecorder<
    void,
    Promise<MockAssembledTransaction<u128>>
  >(async () =>
    createTransactionFixture(await responses.get_total_supply(), txOptions),
  );
  const getDelegate = createRecorder<
    NftAccountArgs,
    Promise<MockAssembledTransaction<Option<string>>>
  >(async () =>
    createTransactionFixture(await responses.get_delegate(), txOptions),
  );
  const ownerOf = createRecorder<
    NftTokenArgs,
    Promise<MockAssembledTransaction<string>>
  >(async () => createTransactionFixture(await responses.owner_of(), txOptions));
  const tokenUri = createRecorder<
    NftTokenArgs,
    Promise<MockAssembledTransaction<string>>
  >(async () =>
    createTransactionFixture(await responses.token_uri(), txOptions),
  );
  const mint = createRecorder<
    NftMintArgs,
    Promise<MockAssembledTransaction<u32>>
  >(async () => createTransactionFixture(await responses.mint(), txOptions));
  const delegate = createRecorder<
    NftDelegateArgs,
    Promise<MockAssembledTransaction<null>>
  >(async () => createTransactionFixture(await responses.delegate(), txOptions));

  const mock: NftClientMock = {
    name,
    symbol,
    balance,
    get_votes: getVotes,
    get_total_supply: getTotalSupply,
    get_delegate: getDelegate,
    owner_of: ownerOf,
    token_uri: tokenUri,
    mint,
    delegate,
    set(key, responder) {
      responses[key] = responder;
    },
    setTransactionOptions(options) {
      txOptions = options;
    },
    reset() {
      responses = { ...defaultNftResponses(), ...initialOverrides };
      txOptions = {};
      name.reset();
      symbol.reset();
      balance.reset();
      getVotes.reset();
      getTotalSupply.reset();
      getDelegate.reset();
      ownerOf.reset();
      tokenUri.reset();
      mint.reset();
      delegate.reset();
    },
  };

  return registerMock(mock);
}
