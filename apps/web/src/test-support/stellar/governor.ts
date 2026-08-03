import { Buffer } from "buffer";
import type { u32, u128 } from "@stellar/stellar-sdk/contract";

import { ProposalState } from "../../lib/bindings/community-governor/src";
import { createRecorder, type CallRecorder } from "./callRecorder";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_PROPOSAL_ID,
  proposalKey,
} from "./fixtures";
import { registerMock } from "./registry";
import { resolved, type Responder } from "./responses";
import {
  createTransactionFixture,
  type MockAssembledTransaction,
  type TransactionFixtureOptions,
} from "./transactions";

export type ProposalArgs = { proposal_id: Buffer };
export type HasVotedArgs = { proposal_id: Buffer; account: string };
export type CastVoteArgs = {
  proposal_id: Buffer;
  vote_type: u32;
  reason: string;
  voter: string;
};
export type ProposeArgs = {
  targets: string[];
  functions: string[];
  args: unknown[][];
  description: string;
  proposer: string;
};
export type ProposalIdArgs = {
  targets: string[];
  functions: string[];
  args: unknown[][];
  description_hash: Buffer;
};
export type QuorumArgs = { ledger: u32 };

/**
 * Response slots mirroring `lib/bindings/community-governor`. `proposal_state`
 * is typed with the real `ProposalState` enum, so an enum change breaks the
 * fixtures at compile time instead of at review time.
 */
export type GovernorResponses = {
  name: Responder<string>;
  version: Responder<string>;
  counting_mode: Responder<string>;
  voting_delay: Responder<u32>;
  voting_period: Responder<u32>;
  proposal_deadline: Responder<u32>;
  proposal_snapshot: Responder<u32>;
  quorum: Responder<u128>;
  proposal_threshold: Responder<u128>;
  cast_vote: Responder<u128>;
  has_voted: Responder<boolean>;
  proposals_need_queuing: Responder<boolean>;
  proposal_state: Responder<ProposalState>;
  proposal_proposer: Responder<string>;
  propose: Responder<Buffer>;
  get_proposal_id: Responder<Buffer>;
};

type Method<TArgs, TValue> = CallRecorder<
  TArgs,
  Promise<MockAssembledTransaction<TValue>>
>;

export type GovernorClientMock = {
  name: Method<void, string>;
  version: Method<void, string>;
  counting_mode: Method<void, string>;
  voting_delay: Method<void, u32>;
  voting_period: Method<void, u32>;
  proposal_deadline: Method<ProposalArgs, u32>;
  proposal_snapshot: Method<ProposalArgs, u32>;
  quorum: Method<QuorumArgs, u128>;
  proposal_threshold: Method<void, u128>;
  cast_vote: Method<CastVoteArgs, u128>;
  has_voted: Method<HasVotedArgs, boolean>;
  proposals_need_queuing: Method<void, boolean>;
  proposal_state: Method<ProposalArgs, ProposalState>;
  proposal_proposer: Method<ProposalArgs, string>;
  propose: Method<ProposeArgs, Buffer>;
  get_proposal_id: Method<ProposalIdArgs, Buffer>;
  set<K extends keyof GovernorResponses>(
    key: K,
    responder: GovernorResponses[K],
  ): void;
  /** Per-proposal state, overriding the `proposal_state` responder. */
  setProposalState(proposalId: Buffer | string, state: ProposalState): void;
  /** Per-(proposal, account) vote record, overriding the `has_voted` responder. */
  setHasVoted(
    proposalId: Buffer | string,
    account: string,
    hasVoted: boolean,
  ): void;
  setTransactionOptions(options: TransactionFixtureOptions): void;
  reset(): void;
};

export function defaultGovernorResponses(): GovernorResponses {
  return {
    name: resolved("Stolla Governor"),
    version: resolved("1"),
    counting_mode: resolved("simple"),
    voting_delay: resolved(10),
    voting_period: resolved(100),
    proposal_deadline: resolved(1_200),
    proposal_snapshot: resolved(1_000),
    quorum: resolved(BigInt(2)),
    proposal_threshold: resolved(BigInt(1)),
    cast_vote: resolved(BigInt(1)),
    has_voted: resolved(false),
    proposals_need_queuing: resolved(false),
    proposal_state: resolved(ProposalState.Active),
    proposal_proposer: resolved(MOCK_ACCOUNT_ALICE),
    propose: resolved(MOCK_PROPOSAL_ID),
    get_proposal_id: resolved(MOCK_PROPOSAL_ID),
  };
}

/**
 * Creates a mock of the Governor client: proposal lifecycle reads, voting
 * power, `has_voted` checks, and proposal/vote submission.
 */
export function createGovernorClientMock(
  overrides: Partial<GovernorResponses> = {},
): GovernorClientMock {
  const initialOverrides: Partial<GovernorResponses> = { ...overrides };

  let responses: GovernorResponses = {
    ...defaultGovernorResponses(),
    ...initialOverrides,
  };
  let txOptions: TransactionFixtureOptions = {};
  const proposalStates = new Map<string, ProposalState>();
  const voteRecords = new Map<string, boolean>();

  const voteKey = (proposalId: Buffer | string, account: string) =>
    `${proposalKey(proposalId)}:${account}`;

  const name = createRecorder<void, Promise<MockAssembledTransaction<string>>>(
    async () => createTransactionFixture(await responses.name(), txOptions),
  );
  const version = createRecorder<
    void,
    Promise<MockAssembledTransaction<string>>
  >(async () => createTransactionFixture(await responses.version(), txOptions));
  const countingMode = createRecorder<
    void,
    Promise<MockAssembledTransaction<string>>
  >(async () =>
    createTransactionFixture(await responses.counting_mode(), txOptions),
  );
  const votingDelay = createRecorder<
    void,
    Promise<MockAssembledTransaction<u32>>
  >(async () =>
    createTransactionFixture(await responses.voting_delay(), txOptions),
  );
  const votingPeriod = createRecorder<
    void,
    Promise<MockAssembledTransaction<u32>>
  >(async () =>
    createTransactionFixture(await responses.voting_period(), txOptions),
  );
  const proposalDeadline = createRecorder<
    ProposalArgs,
    Promise<MockAssembledTransaction<u32>>
  >(async () =>
    createTransactionFixture(await responses.proposal_deadline(), txOptions),
  );
  const proposalSnapshot = createRecorder<
    ProposalArgs,
    Promise<MockAssembledTransaction<u32>>
  >(async () =>
    createTransactionFixture(await responses.proposal_snapshot(), txOptions),
  );
  const quorum = createRecorder<
    QuorumArgs,
    Promise<MockAssembledTransaction<u128>>
  >(async () => createTransactionFixture(await responses.quorum(), txOptions));
  const proposalThreshold = createRecorder<
    void,
    Promise<MockAssembledTransaction<u128>>
  >(async () =>
    createTransactionFixture(await responses.proposal_threshold(), txOptions),
  );
  const castVote = createRecorder<
    CastVoteArgs,
    Promise<MockAssembledTransaction<u128>>
  >(async () =>
    createTransactionFixture(await responses.cast_vote(), txOptions),
  );
  const hasVoted = createRecorder<
    HasVotedArgs,
    Promise<MockAssembledTransaction<boolean>>
  >(async (args) => {
    const override = voteRecords.get(voteKey(args.proposal_id, args.account));
    const value =
      override === undefined ? await responses.has_voted() : override;
    return createTransactionFixture(value, txOptions);
  });
  const proposalsNeedQueuing = createRecorder<
    void,
    Promise<MockAssembledTransaction<boolean>>
  >(async () =>
    createTransactionFixture(
      await responses.proposals_need_queuing(),
      txOptions,
    ),
  );
  const proposalStateRead = createRecorder<
    ProposalArgs,
    Promise<MockAssembledTransaction<ProposalState>>
  >(async (args) => {
    const override = proposalStates.get(proposalKey(args.proposal_id));
    const value =
      override === undefined ? await responses.proposal_state() : override;
    return createTransactionFixture(value, txOptions);
  });
  const proposalProposer = createRecorder<
    ProposalArgs,
    Promise<MockAssembledTransaction<string>>
  >(async () =>
    createTransactionFixture(await responses.proposal_proposer(), txOptions),
  );
  const propose = createRecorder<
    ProposeArgs,
    Promise<MockAssembledTransaction<Buffer>>
  >(async () => createTransactionFixture(await responses.propose(), txOptions));
  const getProposalId = createRecorder<
    ProposalIdArgs,
    Promise<MockAssembledTransaction<Buffer>>
  >(async () =>
    createTransactionFixture(await responses.get_proposal_id(), txOptions),
  );

  const mock: GovernorClientMock = {
    name,
    version,
    counting_mode: countingMode,
    voting_delay: votingDelay,
    voting_period: votingPeriod,
    proposal_deadline: proposalDeadline,
    proposal_snapshot: proposalSnapshot,
    quorum,
    proposal_threshold: proposalThreshold,
    cast_vote: castVote,
    has_voted: hasVoted,
    proposals_need_queuing: proposalsNeedQueuing,
    proposal_state: proposalStateRead,
    proposal_proposer: proposalProposer,
    propose,
    get_proposal_id: getProposalId,
    set(key, responder) {
      responses[key] = responder;
    },
    setProposalState(proposalId, state) {
      proposalStates.set(proposalKey(proposalId), state);
    },
    setHasVoted(proposalId, account, voted) {
      voteRecords.set(voteKey(proposalId, account), voted);
    },
    setTransactionOptions(options) {
      txOptions = options;
    },
    reset() {
      responses = { ...defaultGovernorResponses(), ...initialOverrides };
      txOptions = {};
      proposalStates.clear();
      voteRecords.clear();
      name.reset();
      version.reset();
      countingMode.reset();
      votingDelay.reset();
      votingPeriod.reset();
      proposalDeadline.reset();
      proposalSnapshot.reset();
      quorum.reset();
      proposalThreshold.reset();
      castVote.reset();
      hasVoted.reset();
      proposalsNeedQueuing.reset();
      proposalStateRead.reset();
      proposalProposer.reset();
      propose.reset();
      getProposalId.reset();
    },
  };

  return registerMock(mock);
}
