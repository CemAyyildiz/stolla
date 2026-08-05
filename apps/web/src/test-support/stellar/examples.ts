import { Buffer } from "buffer";

import { ProposalState } from "../../lib/bindings/community-governor/src";
import { MockRpcError } from "./errors";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_ACCOUNT_BOB,
  MOCK_PROPOSAL_ID,
  MOCK_PROPOSAL_INPUT,
  MOCK_SECOND_PROPOSAL_ID,
} from "./fixtures";
import { createGovernorClientMock } from "./governor";
import { createNftClientMock } from "./nft";
import { resetAllStellarMocks } from "./registry";
import { delayed, rejected, resolved } from "./responses";

/**
 * Executable examples for the mocks.
 *
 * These are plain async functions with local assertions, so they type-check and
 * run with or without a test runner installed. `examples.test.ts` registers
 * them with whatever runner is present.
 */

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    assert(false, `${label} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  label: string,
): Promise<Error> {
  try {
    await operation();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error(`assertion failed: ${label} — expected a rejection`);
}

export const stellarMockExamples: Record<string, () => Promise<void>> = {
  "configures NFT collection, balance and voting-power reads": async () => {
    const nft = createNftClientMock();
    nft.set("balance", resolved(4));
    nft.set("get_votes", resolved(BigInt(9)));

    const name = await nft.name();
    const balance = await nft.balance({ account: MOCK_ACCOUNT_ALICE });
    const votes = await nft.get_votes({ account: MOCK_ACCOUNT_ALICE });

    assertEqual(name.result, "Stolla Community", "collection name");
    assertEqual(balance.result, 4, "balance");
    assertEqual(votes.result, BigInt(9), "voting power");

    resetAllStellarMocks();
  },

  "configures proposal-state and has_voted per proposal": async () => {
    const governor = createGovernorClientMock();
    governor.setProposalState(MOCK_PROPOSAL_ID, ProposalState.Succeeded);
    governor.setProposalState(MOCK_SECOND_PROPOSAL_ID, ProposalState.Defeated);
    governor.setHasVoted(MOCK_PROPOSAL_ID, MOCK_ACCOUNT_ALICE, true);

    const first = await governor.proposal_state({
      proposal_id: MOCK_PROPOSAL_ID,
    });
    const second = await governor.proposal_state({
      proposal_id: MOCK_SECOND_PROPOSAL_ID,
    });
    const aliceVoted = await governor.has_voted({
      proposal_id: MOCK_PROPOSAL_ID,
      account: MOCK_ACCOUNT_ALICE,
    });
    const bobVoted = await governor.has_voted({
      proposal_id: MOCK_PROPOSAL_ID,
      account: MOCK_ACCOUNT_BOB,
    });

    assertEqual(first.result, ProposalState.Succeeded, "first proposal state");
    assertEqual(second.result, ProposalState.Defeated, "second proposal state");
    assertEqual(aliceVoted.result, true, "alice has voted");
    assertEqual(bobVoted.result, false, "bob has not voted");

    resetAllStellarMocks();
  },

  "models a delayed read and an RPC rejection": async () => {
    const nft = createNftClientMock();
    nft.set("get_total_supply", delayed(BigInt(12), 5));

    const supply = await nft.get_total_supply();
    assertEqual(supply.result, BigInt(12), "delayed total supply");

    nft.set("balance", rejected("rpc unavailable"));
    const error = await assertRejects(
      () => nft.balance({ account: MOCK_ACCOUNT_ALICE }),
      "rejected balance read",
    );

    assert(error instanceof MockRpcError, "error is a MockRpcError");
    assertEqual(error.message, "rpc unavailable", "rejection message");

    resetAllStellarMocks();
  },

  "asserts contract method arguments": async () => {
    const governor = createGovernorClientMock();

    await governor.cast_vote({
      proposal_id: MOCK_PROPOSAL_ID,
      vote_type: 1,
      reason: "in favour",
      voter: MOCK_ACCOUNT_BOB,
    });

    assertEqual(governor.cast_vote.callCount(), 1, "cast_vote call count");

    const args = governor.cast_vote.lastArgs();
    assert(args !== undefined, "cast_vote recorded its arguments");
    assertEqual(args?.vote_type, 1, "vote type");
    assertEqual(args?.voter, MOCK_ACCOUNT_BOB, "voter");
    assert(
      Buffer.from(args?.proposal_id ?? Buffer.alloc(0)).equals(
        MOCK_PROPOSAL_ID,
      ),
      "proposal id",
    );
    assert(
      governor.cast_vote.wasCalledWith(
        (call) => call.reason === "in favour",
      ),
      "reason was recorded",
    );

    resetAllStellarMocks();
  },

  "models simulation, signing, submission and failure": async () => {
    const signed: string[] = [];
    const governor = createGovernorClientMock();
    governor.setTransactionOptions({
      onSign: (request) => signed.push(request.xdr),
    });

    const tx = await governor.propose(MOCK_PROPOSAL_INPUT);
    await tx.simulate();

    assertEqual(tx.simulationCount(), 1, "simulation count");
    assertEqual(tx.isSigned(), false, "not signed before submission");

    const success = await tx.signAndSend();
    assertEqual(success.status, "SUCCESS", "submission status");
    assertEqual(tx.isSigned(), true, "signed after submission");
    assertEqual(signed.length, 1, "signer invoked once");

    governor.setTransactionOptions({
      outcome: "failure",
      failureMessage: "insufficient voting power",
    });

    const failing = await governor.propose(MOCK_PROPOSAL_INPUT);
    const failure = await failing.signAndSend();

    assertEqual(failure.status, "FAILED", "failed submission status");
    if (failure.status === "FAILED") {
      assertEqual(
        failure.error.message,
        "insufficient voting power",
        "failure message",
      );
    }

    resetAllStellarMocks();
  },

  "resets cleanly between tests": async () => {
    const nft = createNftClientMock();
    nft.set("balance", resolved(99));
    await nft.balance({ account: MOCK_ACCOUNT_ALICE });

    assertEqual(nft.balance.callCount(), 1, "call recorded");

    resetAllStellarMocks();

    assertEqual(nft.balance.callCount(), 0, "calls cleared after reset");

    const restored = await nft.balance({ account: MOCK_ACCOUNT_ALICE });
    assertEqual(restored.result, 1, "default response restored after reset");

    resetAllStellarMocks();
  },
};
