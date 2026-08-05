export type CommunityWizardState = {
  metadata: {
    name: string;
    symbol: string;
    baseUri: string;
    description: string;
    externalUrl: string;
  };
  governance: {
    votingDelay: string;
    votingPeriod: string;
    proposalThreshold: string;
    quorum: string;
  };
};

export type CommunityFactoryMetadata = {
  name: string;
  symbol: string;
  base_uri: string;
  description: string;
  external_url: string;
};

export type CommunityFactoryGovernance = {
  voting_delay: number;
  voting_period: number;
  proposal_threshold: bigint;
  quorum: bigint;
};

export type CommunityFactoryCreateArgs = {
  creator: string;
  metadata: CommunityFactoryMetadata;
  governance: CommunityFactoryGovernance;
};

export type CommunityDeploymentResult = {
  nft_contract: string;
  governor_contract: string;
};

const U32_MAX = 4_294_967_295n;

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function parseU32(value: string, label: string): number {
  const parsed = parseWholeNumber(value, label);
  if (parsed > U32_MAX) {
    throw new Error(`${label} must fit in u32.`);
  }
  return Number(parsed);
}

function parseU128(value: string, label: string): bigint {
  return parseWholeNumber(value, label);
}

function parseWholeNumber(value: string, label: string): bigint {
  const trimmed = requireText(value, label);
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return BigInt(trimmed);
}

export function serializeCommunityFactoryArgs(
  state: CommunityWizardState,
  creator: string,
): CommunityFactoryCreateArgs {
  return {
    creator: requireText(creator, "Creator wallet"),
    metadata: {
      name: requireText(state.metadata.name, "Community name"),
      symbol: requireText(state.metadata.symbol, "NFT symbol"),
      base_uri: requireText(state.metadata.baseUri, "Base metadata URI"),
      description: requireText(state.metadata.description, "Description"),
      external_url: state.metadata.externalUrl.trim(),
    },
    governance: {
      voting_delay: parseU32(state.governance.votingDelay, "Voting delay"),
      voting_period: parseU32(state.governance.votingPeriod, "Voting period"),
      proposal_threshold: parseU128(
        state.governance.proposalThreshold,
        "Proposal threshold",
      ),
      quorum: parseU128(state.governance.quorum, "Quorum"),
    },
  };
}
