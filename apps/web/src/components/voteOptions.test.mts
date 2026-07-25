import assert from "node:assert/strict";
import test from "node:test";
import { VOTE_OPTIONS } from "./voteOptions.ts";

test("vote controls preserve the contract values and visual order", () => {
  assert.deepEqual(
    VOTE_OPTIONS.map(({ label, type }) => ({ label, type })),
    [
      { label: "For", type: 1 },
      { label: "Against", type: 0 },
      { label: "Abstain", type: 2 },
    ],
  );
});

test("every vote choice has distinct non-color content and a pending label", () => {
  assert.equal(new Set(VOTE_OPTIONS.map(({ label }) => label)).size, 3);
  assert.equal(new Set(VOTE_OPTIONS.map(({ symbol }) => symbol)).size, 3);

  for (const option of VOTE_OPTIONS) {
    assert.match(option.pendingLabel, new RegExp(option.label));
  }
});
