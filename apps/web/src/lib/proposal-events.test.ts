import { SorobanRpc } from "@stellar/stellar-sdk";
import { getProposalEvents } from "./proposal-events";
import { contractIds, config } from "./stellar";

// Mock the SorobanRpc.Server
const mockGetEvents = jest.fn();
const mockServerInstance = { getEvents: mockGetEvents };
const mockServerConstructor = jest.fn().mockImplementation(() => mockServerInstance);

jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SorobanRpc: { Server: (url: any, opts: any) => mockServerConstructor(url, opts) },
}));

// Mock the stellar config
jest.mock("./stellar", () => ({
  config: {
    rpcUrl: "https://test.rpc.url",
  },
  contractIds: {
    governor: "C123456789",
  },
}));

describe("getProposalEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if governor contract ID is not configured", async () => {
    // @ts-ignore
    contractIds.governor = "";
    await expect(getProposalEvents(1)).rejects.toThrow(
      "Governor contract ID is not configured. Set NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
    // @ts-ignore
    contractIds.governor = "C123456789"; // Restore for other tests
  });

  it("should call getEvents with the correct parameters", async () => {
    mockGetEvents.mockResolvedValue({ events: [] });
    await getProposalEvents(123, "cursor123");

    expect(mockServerConstructor).toHaveBeenCalledWith("https://test.rpc.url", { "allowHttp": false });
    expect(mockGetEvents).toHaveBeenCalledWith({
      startLedger: 123,
      filters: [
        {
          type: "contract",
          contractIds: ["C123456789"],
        },
        {
          type: "topic",
          segments: ["*"],
        },
      ],
      cursor: "cursor123",
      limit: 10,
    });
    expect(mockGetEvents).toHaveBeenCalledTimes(1);
  });

  it("should return events, latestLedger, and cursor", async () => {
    const mockResponse = {
      events: [
        { topic: ["proposal_created"], data: "data1" },
        { topic: ["vote_cast"], data: "data2" },
      ],
      latestLedger: 456,
      cursor: "nextCursor",
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(1);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].topic[0]).toBe("proposal_created");
    expect(result.latestLedger).toBe(456);
    expect(result.cursor).toBe("nextCursor");
  });

  it("should filter out events with topics not in PROPOSAL_TOPICS", async () => {
    const mockResponse = {
      events: [
        { topic: ["proposal_created"], data: "data1" },
        { topic: ["some_other_event"], data: "data2" },
        { topic: ["vote_cast"], data: "data3" },
      ],
      latestLedger: 789,
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(1);

    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.topic[0])).toEqual([
      "proposal_created",
      "vote_cast",
    ]);
  });

  it("should handle empty events array from RPC", async () => {
    const mockResponse = {
      events: [],
      latestLedger: 101,
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(1);

    expect(result.events).toHaveLength(0);
    expect(result.latestLedger).toBe(101);
  });

  it("should handle undefined events array from RPC", async () => {
    const mockResponse = {
      latestLedger: 102,
    };
    mockGetEvents.mockResolvedValue(mockResponse);

    const result = await getProposalEvents(1);

    expect(result.events).toHaveLength(0);
    expect(result.latestLedger).toBe(102);
  });
});
