import { MockRpcError } from "./errors";

/**
 * A configurable read outcome. Every mock method resolves its value through a
 * `Responder`, which is what lets one test return data, another delay it, and a
 * third reject it without touching the mock's implementation.
 */
export type Responder<T> = () => Promise<T>;

/** Resolves immediately with `value`. */
export function resolved<T>(value: T): Responder<T> {
  return () => Promise.resolve(value);
}

/**
 * Resolves with `value` after `delayMs`. Use with fake timers, or with small
 * real delays, to cover loading states and out-of-order responses.
 */
export function delayed<T>(value: T, delayMs: number): Responder<T> {
  return () =>
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(value), delayMs);
    });
}

/** Rejects, modelling an RPC or simulation failure. */
export function rejected<T>(error: Error | string = new MockRpcError()): Responder<T> {
  const failure = typeof error === "string" ? new MockRpcError(error) : error;
  return () => Promise.reject(failure);
}

/**
 * Returns each responder in turn, repeating the last one once exhausted.
 * Useful for "fails, then succeeds on retry" scenarios.
 */
export function sequence<T>(...responders: Array<Responder<T>>): Responder<T> {
  if (responders.length === 0) {
    throw new Error("sequence() requires at least one responder");
  }

  let index = 0;

  return () => {
    const responder = responders[Math.min(index, responders.length - 1)];
    index += 1;
    return responder();
  };
}
