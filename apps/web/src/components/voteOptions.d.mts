export type VoteOption = {
  readonly type: 0 | 1 | 2;
  readonly label: string;
  readonly pendingLabel: string;
  readonly symbol: string;
};

export const VOTE_OPTIONS: readonly [
  VoteOption & { readonly type: 1 },
  VoteOption & { readonly type: 0 },
  VoteOption & { readonly type: 2 },
];

export type VoteType = (typeof VOTE_OPTIONS)[number]["type"];
