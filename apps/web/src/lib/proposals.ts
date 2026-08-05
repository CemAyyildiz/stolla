import { Buffer } from "buffer";

export const PROPOSAL_ID_BYTES = 32;
export const PROPOSAL_ID_HEX_LENGTH = PROPOSAL_ID_BYTES * 2;

const PROPOSAL_ID_HEX = /^[0-9a-fA-F]+$/;

/**
 * Parses a proposal ID from its hex URL form.
 *
 * Returns the 32-byte proposal ID buffer used by the Governor contract, or
 * `null` when the value is missing, non-hexadecimal, or not exactly 32 bytes
 * so malformed IDs are rejected before any Buffer or RPC request is created.
 */
export function parseProposalId(id: string | undefined): Buffer | null {
  if (!id || id.length !== PROPOSAL_ID_HEX_LENGTH) return null;
  if (!PROPOSAL_ID_HEX.test(id)) return null;
  return Buffer.from(id, "hex");
}
