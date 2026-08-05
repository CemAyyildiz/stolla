export const MOCK_WALLET_FLAG = "mock";

/**
 * Written as a plain expression over two inlined build constants so a
 * production bundle folds it to `false` and drops the mocked wallet chunk
 * instead of merely leaving it unreachable. `next.config.ts` refuses to build
 * for production while the flag is set, so the two guards fail closed
 * independently.
 */
export const MOCK_WALLET_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_E2E_WALLET === MOCK_WALLET_FLAG;

/** The same rule as a pure function, so tests can cover inputs a build cannot. */
export function isMockWalletEnabled(
  flag: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  return nodeEnv !== "production" && flag === MOCK_WALLET_FLAG;
}
