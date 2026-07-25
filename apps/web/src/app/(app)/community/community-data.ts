export interface CollectionData {
  name: string;
  symbol: string;
  balance: number | null;
  votes: string | null;
}

interface Result<T> {
  result?: T;
}

export interface CollectionClient {
  name(): Promise<Result<string>>;
  symbol(): Promise<Result<string>>;
}

export interface CommunityUserClient {
  balance(input: { account: string }): Promise<Result<unknown>>;
  get_votes(input: { account: string }): Promise<Result<unknown>>;
}

interface LoadCommunityDataOptions {
  address: string | null;
  collectionClient: CollectionClient;
  userClient: CommunityUserClient | null;
}

interface CommunityRefreshCallbacks {
  onStart(): void;
  onSuccess(data: CollectionData): void;
  onError(message: string): void;
}

export async function loadCommunityData({
  address,
  collectionClient,
  userClient,
}: LoadCommunityDataOptions): Promise<CollectionData> {
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

export function communityDataErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load NFT data";
}

export async function runCommunityRefresh(
  load: () => Promise<CollectionData>,
  callbacks: CommunityRefreshCallbacks,
): Promise<boolean> {
  callbacks.onStart();

  try {
    callbacks.onSuccess(await load());
    return true;
  } catch (error: unknown) {
    callbacks.onError(communityDataErrorMessage(error));
    return false;
  }
}
