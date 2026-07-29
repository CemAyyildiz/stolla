import type { AssembledTransaction, MethodOptions } from "@stellar/stellar-sdk/contract";
import { Client as ContractClient } from "@stellar/stellar-sdk/contract";
import type {
  CommunityDeploymentResult,
  CommunityFactoryGovernance,
  CommunityFactoryMetadata,
} from "@/lib/communityFactory/types";

export type { CommunityDeploymentResult, CommunityFactoryGovernance, CommunityFactoryMetadata };

export type DeployCommunityArgs = {
  creator: string;
  metadata: CommunityFactoryMetadata;
  governance: CommunityFactoryGovernance;
};

export interface CommunityFactoryClient {
  deploy_community: (
    args: DeployCommunityArgs,
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<CommunityDeploymentResult>>;
}

export class Client extends ContractClient implements CommunityFactoryClient {
  deploy_community = this.txFromJSON<CommunityDeploymentResult>;
}
