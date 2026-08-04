/**
 * Error types and deterministic hashes used by the Stellar contract mocks.
 *
 * Production-facing helpers in `src/test-support` remain runner-agnostic; only
 * the example test imports Vitest.
 */

/** 64 hex characters, the shape of a Stellar transaction hash. */
export const DEFAULT_TX_HASH = "11".repeat(32);

/** Distinct hash returned by fixtures configured to fail submission. */
export const DEFAULT_FAILED_TX_HASH = "ff".repeat(32);

/** Raised by mocks that model an RPC read rejecting (network/server error). */
export class MockRpcError extends Error {
  constructor(message = "simulated RPC failure") {
    super(message);
    this.name = "MockRpcError";
  }
}

/** Raised or returned by mocks that model an on-chain transaction failure. */
export class MockTransactionFailedError extends Error {
  readonly hash: string;

  constructor(
    message = "simulated transaction failure",
    hash: string = DEFAULT_FAILED_TX_HASH,
  ) {
    super(message);
    this.name = "MockTransactionFailedError";
    this.hash = hash;
  }
}
