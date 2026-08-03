export async function loadCommunityData({
  address,
  collectionClient,
  userClient,
}) {
  const [collectionName, collectionSymbol] = await Promise.all([
    collectionClient.name(),
    collectionClient.symbol(),
  ]);

  if (!address || !userClient) {
    return {
      name: collectionName.result ?? "",
      symbol: collectionSymbol.result ?? "",
      balance: null,
      votes: null,
    };
  }

  const [balance, votes] = await Promise.all([
    userClient.balance({ account: address }),
    userClient.get_votes({ account: address }),
  ]);

  return {
    name: collectionName.result ?? "",
    symbol: collectionSymbol.result ?? "",
    balance: Number(balance.result ?? 0),
    votes: String(votes.result ?? 0),
  };
}

export function communityDataErrorMessage(error) {
  return error instanceof Error ? error.message : "Failed to load NFT data";
}

export async function runCommunityRefresh(load, callbacks) {
  callbacks.onStart();

  try {
    callbacks.onSuccess(await load());
    return true;
  } catch (error) {
    callbacks.onError(communityDataErrorMessage(error));
    return false;
  }
}
