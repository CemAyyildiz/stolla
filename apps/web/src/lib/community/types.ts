export type CommunityExternalLink = {
  label: string;
  url: string;
};

export type CommunityMetadata = {
  schemaVersion: 1;
  name: string;
  description: string;
  logo?: string;
  externalLinks: CommunityExternalLink[];
};

export type CommunityRegistryRecord = {
  id: string;
  nftContract: string;
  governorContract: string;
  creator: string;
  communityOwner: string;
  createdAtLedger: number;
  creationIndex: number;
  metadataUri: string;
  metadataHash: string;
  metadataSchemaVersion: number;
};

export type GovernanceSnapshot = {
  votingDelay: number | null;
  votingPeriod: number | null;
  proposalThreshold: string | null;
  quorum: string | null;
  unavailableFields: string[];
};

export type CommunityView = {
  record: CommunityRegistryRecord;
  metadata: CommunityMetadata | null;
  metadataError: string | null;
  governance: GovernanceSnapshot;
};

export type CommunityRegistryPage = {
  communities: CommunityView[];
  nextCursor: number | null;
  malformedRecords: number;
};

export type CommunityDetailResult =
  | { status: "found"; community: CommunityView }
  | { status: "not-found" }
  | { status: "malformed"; message: string };
