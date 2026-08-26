import { beforeEach, describe, expect, it, vi } from "vitest";
import { xdr } from "@stellar/stellar-sdk";
import {
  createEventPage,
  createEventsRpcMock,
  createVoteEvent,
  type EventsRpcMock,
} from "@/test-support/stellar";
import { fetchVoteTotals } from "./voteAggregation";

let eventsRpc: EventsRpcMock;
const PROPOSAL_ID = "aa".repeat(32);

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function (this: Record<string, unknown>) {
        this.getEvents = (request: Parameters<EventsRpcMock["getEvents"]>[0]) =>
          eventsRpc.getEvents(request);
      }),
    },
  };
});

vi.mock("./stellar", async () => {
  const { createNetworkFixture } = await import(
    "@/test-support/stellar/network"
  );
  return createNetworkFixture();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up a page of getEvents returning the given events with their native values. */
function setupPage(
  events: Array<{ id: string; native: [number, bigint, string] }>,
  cursor?: string,
) {
  eventsRpc.setOutcomes(
    createEventPage(
      events.map(({ id, native: [voteType, weight, reason] }) =>
        createVoteEvent({
          id,
          proposalId: PROPOSAL_ID,
          voteType,
          weight,
          reason,
        }),
      ),
      { cursor },
    ),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchVoteTotals", () => {
  beforeEach(() => {
    eventsRpc = createEventsRpcMock();
  });

  describe("mixed weighted votes", () => {
    it("aggregates For, Against, and Abstain weights correctly", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      setupPage([
        { id: "1-0", native: [1, BigInt(100), "I support this"] },
        { id: "1-1", native: [0, BigInt(50), "Disagree"] },
        { id: "1-2", native: [2, BigInt(25), "Neutral"] },
        { id: "1-3", native: [1, BigInt(200), "Strongly support"] },
      ]);

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals).toEqual({
        for: BigInt(300),
        against: BigInt(50),
        abstain: BigInt(25),
        total: BigInt(375),
      });
      expect(result.incomplete).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("uses bigint without precision loss for large weights", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const hugeWeight = BigInt(
        "340282366920938463463374607431768211455",
      );

      setupPage([{ id: "1-0", native: [1, hugeWeight, ""] }]);

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(hugeWeight);
      expect(typeof result.totals.for).toBe("bigint");
    });
  });

  describe("no votes", () => {
    it("returns zero totals when there are no events", async () => {
      eventsRpc.setOutcomes(createEventPage([]));

      const result = await fetchVoteTotals(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.totals).toEqual({
        for: BigInt(0),
        against: BigInt(0),
        abstain: BigInt(0),
        total: BigInt(0),
      });
      expect(result.incomplete).toBe(false);
    });
  });

  describe("unrelated events", () => {
    it("correctly aggregates only the events the RPC returns for the filtered proposal", async () => {
      setupPage([
        { id: "1-0", native: [1, BigInt(10), ""] },
        { id: "1-1", native: [1, BigInt(20), ""] },
      ]);

      const result = await fetchVoteTotals(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.totals.for).toBe(BigInt(30));
    });
  });

  describe("malformed events", () => {
    it("handles events where scValToNative throws by marking incomplete", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      eventsRpc.setOutcomes(
        createEventPage([
          createVoteEvent({
            id: "1-0",
            proposalId: PROPOSAL_ID,
            value: xdr.ScVal.scvVoid(),
          }),
          createVoteEvent({
            id: "1-1",
            proposalId: PROPOSAL_ID,
            voteType: 1,
            weight: BigInt(200),
          }),
        ]),
      );

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(BigInt(200));
      expect(result.incomplete).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("handles unexpected vote types gracefully", async () => {
      setupPage([
        { id: "1-0", native: [1, BigInt(100), ""] },
        { id: "1-1", native: [3, BigInt(50), ""] },
        { id: "1-2", native: [99, BigInt(25), ""] },
      ]);

      const result = await fetchVoteTotals(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(0));
      expect(result.totals.abstain).toBe(BigInt(0));
      expect(result.totals.total).toBe(BigInt(100));
    });
  });

  describe("deduplication", () => {
    it("deduplicates events by event ID", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      // Events: "1-0" appears twice (only first counted), "1-1" is new.
      eventsRpc.setOutcomes(
        createEventPage([
          createVoteEvent({
            id: "1-0",
            proposalId: PROPOSAL_ID,
            voteType: 1,
            weight: BigInt(100),
          }),
          createVoteEvent({
            id: "1-0",
            proposalId: PROPOSAL_ID,
            voteType: 1,
            weight: BigInt(999),
          }),
          createVoteEvent({
            id: "1-1",
            proposalId: PROPOSAL_ID,
            voteType: 0,
            weight: BigInt(50),
          }),
        ]),
      );

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(50));
      expect(result.totals.total).toBe(BigInt(150));
    });
  });

  describe("RPC errors", () => {
    it("returns incomplete with error message when getEvents throws", async () => {
      eventsRpc.setOutcomes(new Error("Network timeout"));

      const result = await fetchVoteTotals(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.totals).toEqual({
        for: BigInt(0),
        against: BigInt(0),
        abstain: BigInt(0),
        total: BigInt(0),
      });
      expect(result.incomplete).toBe(true);
      expect(result.error).toBe("Network timeout");
    });

    it("handles non-Error thrown objects", async () => {
      eventsRpc.setOutcomes("string error");

      const result = await fetchVoteTotals(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.incomplete).toBe(true);
      expect(result.error).toBe("Failed to fetch vote events");
    });
  });

  describe("pagination", () => {
    it("aggregates votes across multiple pages", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      const page1Events = Array.from({ length: 100 }, (_, i) =>
        createVoteEvent({
          id: `1-${i}`,
          proposalId: PROPOSAL_ID,
          voteType: 1,
          weight: BigInt(1),
        }),
      );
      const page2Events = Array.from({ length: 50 }, (_, i) =>
        createVoteEvent({
          id: `2-${i}`,
          proposalId: PROPOSAL_ID,
          voteType: 0,
          weight: BigInt(1),
        }),
      );
      eventsRpc.setOutcomes(
        createEventPage(page1Events, { cursor: "cursor-2" }),
        createEventPage(page2Events),
      );

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.for).toBe(BigInt(100));
      expect(result.totals.against).toBe(BigInt(50));
      expect(result.totals.total).toBe(BigInt(150));
      expect(result.incomplete).toBe(false);
    });

    it("stops pagination when fewer than limit events returned", async () => {
      const proposalHex =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      const page1Events = Array.from({ length: 30 }, (_, i) =>
        createVoteEvent({
          id: `1-${i}`,
          proposalId: PROPOSAL_ID,
          voteType: 2,
          weight: BigInt(2),
        }),
      );
      eventsRpc.setOutcomes(createEventPage(page1Events));

      const result = await fetchVoteTotals(proposalHex);

      expect(result.totals.abstain).toBe(BigInt(60));
      expect(eventsRpc.getEvents.callCount()).toBe(1);
    });
  });
});
