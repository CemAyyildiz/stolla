import assert from "node:assert/strict";
import test from "node:test";
import { loadProposalList } from "./proposal-loader.mjs";

test("returns an error when proposal discovery fails", async () => {
  const result = await loadProposalList({
    getProposalIds() {
      throw new Error("local storage unavailable");
    },
    loadProposalState() {
      throw new Error("should not load states");
    },
  });

  assert.equal(result.status, "error");
  assert.deepEqual(result.proposalIds, []);
});

test("returns a top-level error when every state request fails", async () => {
  const requestedIds = [];
  const result = await loadProposalList({
    getProposalIds: () => ["proposal-a", "proposal-b"],
    async loadProposalState(proposalId) {
      requestedIds.push(proposalId);
      throw new Error("RPC unavailable");
    },
  });

  assert.equal(result.status, "error");
  assert.deepEqual(result.proposalIds, ["proposal-a", "proposal-b"]);
  assert.deepEqual(result.states, {});
  assert.deepEqual(result.failedIds, ["proposal-a", "proposal-b"]);
  assert.deepEqual(requestedIds, ["proposal-a", "proposal-b"]);
});

test("preserves successful proposal states after a partial failure", async () => {
  const result = await loadProposalList({
    getProposalIds: () => ["proposal-a", "proposal-b"],
    loadProposalState(proposalId) {
      if (proposalId === "proposal-b") {
        throw new Error("RPC request failed");
      }
      return "Active";
    },
  });

  assert.equal(result.status, "populated");
  assert.deepEqual(result.proposalIds, ["proposal-a", "proposal-b"]);
  assert.deepEqual(result.states, { "proposal-a": "Active" });
  assert.deepEqual(result.failedIds, ["proposal-b"]);
});

test("a retry repeats discovery and state loading and can recover", async () => {
  let rpcAvailable = false;
  let discoveryCalls = 0;
  let stateCalls = 0;
  const options = {
    getProposalIds() {
      discoveryCalls += 1;
      return ["proposal-a"];
    },
    async loadProposalState() {
      stateCalls += 1;
      if (!rpcAvailable) {
        throw new Error("RPC unavailable");
      }
      return "Succeeded";
    },
  };

  const failedLoad = await loadProposalList(options);
  rpcAvailable = true;
  const successfulRetry = await loadProposalList(options);

  assert.equal(failedLoad.status, "error");
  assert.equal(successfulRetry.status, "populated");
  assert.deepEqual(successfulRetry.states, { "proposal-a": "Succeeded" });
  assert.equal(discoveryCalls, 2);
  assert.equal(stateCalls, 2);
});

test("returns a genuine empty state without requesting proposal states", async () => {
  let stateCalls = 0;
  const result = await loadProposalList({
    getProposalIds: () => [],
    loadProposalState() {
      stateCalls += 1;
      return "Active";
    },
  });

  assert.equal(result.status, "empty");
  assert.equal(stateCalls, 0);
});
