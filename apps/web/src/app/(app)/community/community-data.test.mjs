import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCommunityData,
  runCommunityRefresh,
} from "./community-data.mjs";

const CURRENT_DATA = {
  name: "Stolla Community",
  symbol: "STOLLA",
  balance: 2,
  votes: "2",
};

function callbacks() {
  const state = {
    starts: 0,
    data: null,
    error: null,
  };

  return {
    state,
    handlers: {
      onStart() {
        state.starts += 1;
        state.error = null;
      },
      onSuccess(data) {
        state.data = data;
      },
      onError(message) {
        state.error = message;
      },
    },
  };
}

test("a failed initial request can be retried through the same refresh path", async () => {
  let attempt = 0;
  const collectionClient = {
    async name() {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("RPC temporarily unavailable");
      }
      return { result: CURRENT_DATA.name };
    },
    async symbol() {
      return { result: CURRENT_DATA.symbol };
    },
  };
  const userClient = {
    async balance() {
      return { result: CURRENT_DATA.balance };
    },
    async get_votes() {
      return { result: BigInt(CURRENT_DATA.votes ?? "0") };
    },
  };
  const refreshState = callbacks();
  const load = () =>
    loadCommunityData({
      address: "GTEST",
      collectionClient,
      userClient,
    });

  assert.equal(
    await runCommunityRefresh(load, refreshState.handlers),
    false,
  );
  assert.equal(refreshState.state.error, "RPC temporarily unavailable");
  assert.equal(refreshState.state.data, null);

  assert.equal(
    await runCommunityRefresh(load, refreshState.handlers),
    true,
  );
  assert.deepEqual(refreshState.state.data, CURRENT_DATA);
  assert.equal(refreshState.state.error, null);
  assert.equal(refreshState.state.starts, 2);
});

test("a repeated failure preserves an actionable data-load error", async () => {
  const refreshState = callbacks();
  const load = async () => {
    throw new Error("RPC still unavailable");
  };

  assert.equal(
    await runCommunityRefresh(load, refreshState.handlers),
    false,
  );
  assert.equal(
    await runCommunityRefresh(load, refreshState.handlers),
    false,
  );
  assert.equal(refreshState.state.error, "RPC still unavailable");
  assert.equal(refreshState.state.starts, 2);
});
