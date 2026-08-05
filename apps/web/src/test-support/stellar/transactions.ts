import {
  DEFAULT_FAILED_TX_HASH,
  DEFAULT_TX_HASH,
  MockTransactionFailedError,
} from "./errors";

/** What `signAndSend()` resolves with. */
export type SubmitOutcome<T> =
  | { status: "SUCCESS"; hash: string; result: T }
  | { status: "FAILED"; hash: string; error: MockTransactionFailedError };

/** Recorded whenever a fixture is signed, so signing can be asserted. */
export type SignRequest = { xdr: string; networkPassphrase?: string };

/**
 * The subset of `AssembledTransaction` the web app actually uses: read the
 * simulated `result`, optionally re-`simulate()`, then `signAndSend()`.
 */
export type MockAssembledTransaction<T> = {
  readonly result: T;
  simulate(): Promise<MockAssembledTransaction<T>>;
  signAndSend(): Promise<SubmitOutcome<T>>;
  toXDR(): string;
  isSigned(): boolean;
  simulationCount(): number;
  signatureCount(): number;
};

export type TransactionFixtureOptions = {
  hash?: string;
  /** "success" (default) or "failure" for a rejected/failed submission. */
  outcome?: "success" | "failure";
  failureMessage?: string;
  xdr?: string;
  /** Called on every `signAndSend()`, modelling the wallet signer. */
  onSign?: (request: SignRequest) => void;
  networkPassphrase?: string;
  /**
   * When true, a failing fixture throws instead of resolving with
   * `{ status: "FAILED" }`. Both shapes occur in practice, so both are covered.
   */
  rejectOnSubmit?: boolean;
};

/**
 * Builds a transaction fixture covering simulation, signing, successful
 * submission and failure. No network or wallet extension is involved.
 */
export function createTransactionFixture<T>(
  result: T,
  options: TransactionFixtureOptions = {},
): MockAssembledTransaction<T> {
  const outcome = options.outcome ?? "success";
  const xdr = options.xdr ?? "AAAAAgAAAABtb2NrZWQtZW52ZWxvcGU=";
  const hash =
    options.hash ??
    (outcome === "success" ? DEFAULT_TX_HASH : DEFAULT_FAILED_TX_HASH);

  let simulations = 0;
  let signatures = 0;

  const fixture: MockAssembledTransaction<T> = {
    result,
    async simulate() {
      simulations += 1;
      return fixture;
    },
    async signAndSend() {
      signatures += 1;

      if (options.onSign) {
        options.onSign({
          xdr,
          networkPassphrase: options.networkPassphrase,
        });
      }

      if (outcome === "failure") {
        const error = new MockTransactionFailedError(
          options.failureMessage ?? "simulated transaction failure",
          hash,
        );

        if (options.rejectOnSubmit) {
          throw error;
        }

        return { status: "FAILED", hash, error };
      }

      return { status: "SUCCESS", hash, result };
    },
    toXDR() {
      return xdr;
    },
    isSigned() {
      return signatures > 0;
    },
    simulationCount() {
      return simulations;
    },
    signatureCount() {
      return signatures;
    },
  };

  return fixture;
}
