/**
 * Load locally discovered proposals and their current states while retaining
 * every state request that succeeds.
 *
 * @template T
 * @param {{
 *   getProposalIds: () => string[] | Promise<string[]>,
 *   loadProposalState?: (proposalId: string) => T | Promise<T>,
 * }} options
 * @returns {Promise<{
 *   status: "empty" | "error" | "populated",
 *   proposalIds: string[],
 *   states: Record<string, T>,
 *   failedIds: string[],
 * }>}
 */
export async function loadProposalList({
  getProposalIds,
  loadProposalState,
}) {
  let proposalIds;

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
  /** @type {Record<string, T>} */
  const states = {};
  /** @type {string[]} */
  const failedIds = [];

  results.forEach((result, index) => {
    const proposalId = proposalIds[index];
    if (result.status === "fulfilled") {
      states[proposalId] = result.value;
    } else {
      failedIds.push(proposalId);
    }
  });

  return {
    status:
      failedIds.length === proposalIds.length ? "error" : "populated",
    proposalIds,
    states,
    failedIds,
  };
}
