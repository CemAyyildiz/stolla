import { describe, expect, it } from "vitest";
import { loadProposalList } from "./proposal-loader";

describe("loadProposalList", () => {
  it("returns an error when proposal discovery fails", async () => {
    const result = await loadProposalList({
      getProposalIds() {
        throw new Error("local storage unavailable");
      },
      loadProposalState() {
        throw new Error("should not load states");
      },
    });

    expect(result.status).toBe("error");
    expect(result.proposalIds).toEqual([]);
  });

  it("returns a top-level error when every state request fails", async () => {
    const requestedIds: string[] = [];
    const result = await loadProposalList({
      getProposalIds: () => ["proposal-a", "proposal-b"],
      async loadProposalState(proposalId) {
        requestedIds.push(proposalId);
        throw new Error("RPC unavailable");
      },
    });

    expect(result.status).toBe("error");
    expect(result.proposalIds).toEqual(["proposal-a", "proposal-b"]);
    expect(result.states).toEqual({});
    expect(result.failedIds).toEqual(["proposal-a", "proposal-b"]);
    expect(requestedIds).toEqual(["proposal-a", "proposal-b"]);
  });

  it("preserves successful proposal states after a partial failure", async () => {
    const result = await loadProposalList({
      getProposalIds: () => ["proposal-a", "proposal-b"],
      loadProposalState(proposalId) {
        if (proposalId === "proposal-b") {
          throw new Error("RPC request failed");
        }
        return "Active";
      },
    });

    expect(result.status).toBe("populated");
    expect(result.proposalIds).toEqual(["proposal-a", "proposal-b"]);
    expect(result.states).toEqual({ "proposal-a": "Active" });
    expect(result.failedIds).toEqual(["proposal-b"]);
  });

  it("repeats discovery and state loading and can recover on retry", async () => {
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

    expect(failedLoad.status).toBe("error");
    expect(successfulRetry.status).toBe("populated");
    expect(successfulRetry.states).toEqual({ "proposal-a": "Succeeded" });
    expect(discoveryCalls).toBe(2);
    expect(stateCalls).toBe(2);
  });

  it("returns a genuine empty state without requesting proposal states", async () => {
    let stateCalls = 0;
    const result = await loadProposalList({
      getProposalIds: () => [],
      loadProposalState() {
        stateCalls += 1;
        return "Active";
      },
    });

    expect(result.status).toBe("empty");
    expect(stateCalls).toBe(0);
  });
});
