import { Buffer } from "buffer";
import { vi } from "vitest";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import type {
  ProposalReader,
  ProposalReaderFactory,
} from "@/lib/communities/proposals";

/**
 * Reusable, per-Governor-contract mock RPC surface.
 *
 * Keying state by contractId (not by proposal id alone) reproduces the real
 * chain invariant: the same numeric proposal id under two different Governor
 * contracts is two independent pieces of on-chain state.
 */
export type GovernorFixture = {
  contractId: string;
  proposals: Record<string, ProposalState | Error>;
};

export function createGovernorReaderFactory(
  fixtures: GovernorFixture[],
): ProposalReaderFactory & { calls: Array<{ contractId: string; proposalId: string }> } {
  const byContractId = new Map(fixtures.map((fixture) => [fixture.contractId, fixture]));
  const calls: Array<{ contractId: string; proposalId: string }> = [];

  const factory = ((contractId: string): ProposalReader => ({
    proposal_state: vi.fn(async ({ proposal_id }: { proposal_id: Buffer }) => {
      const proposalId = proposal_id.toString("hex");
      calls.push({ contractId, proposalId });

      const fixture = byContractId.get(contractId);
      const outcome = fixture?.proposals[proposalId];

      if (outcome === undefined) {
        throw new Error(`No fixture proposal ${proposalId} for governor ${contractId}`);
      }
      if (outcome instanceof Error) {
        throw outcome;
      }
      return { result: outcome };
    }),
  })) as ProposalReaderFactory & {
    calls: Array<{ contractId: string; proposalId: string }>;
  };

  factory.calls = calls;
  return factory;
}
