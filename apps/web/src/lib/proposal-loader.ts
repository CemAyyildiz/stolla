export type ProposalListResult<T> = {
  status: "empty" | "error" | "populated";
  proposalIds: string[];
  states: Record<string, T>;
  failedIds: string[];
};

type ProposalListOptions<T> = {
  getProposalIds: () => string[] | Promise<string[]>;
  loadProposalState?: (proposalId: string) => T | Promise<T>;
};

/**
 * Loads locally discovered proposals and their current states while retaining
 * every state request that succeeds.
 */
export async function loadProposalList<T>({
  getProposalIds,
  loadProposalState,
}: ProposalListOptions<T>): Promise<ProposalListResult<T>> {
  let proposalIds: string[];

  try {
    proposalIds = await getProposalIds();
  } catch {
    return {
      status: "error",
      proposalIds: [],
      states: {},
      failedIds: [],
    };
  }

  if (proposalIds.length === 0) {
    return {
      status: "empty",
      proposalIds,
      states: {},
      failedIds: [],
    };
  }

  if (!loadProposalState) {
    return {
      status: "populated",
      proposalIds,
      states: {},
      failedIds: [],
    };
  }

  const results = await Promise.allSettled(
    proposalIds.map((proposalId) =>
      Promise.resolve().then(() => loadProposalState(proposalId)),
    ),
  );
  const states: Record<string, T> = {};
  const failedIds: string[] = [];

  results.forEach((result, index) => {
    const proposalId = proposalIds[index];
    if (result.status === "fulfilled") {
      states[proposalId] = result.value;
    } else {
      failedIds.push(proposalId);
    }
  });

  return {
    status: failedIds.length === proposalIds.length ? "error" : "populated",
    proposalIds,
    states,
    failedIds,
  };
}
