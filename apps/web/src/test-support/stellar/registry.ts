/**
 * Registry of every mock created in the current process, so a single call can
 * restore them all between tests.
 */
export type Resettable = { reset(): void };

const registry = new Set<Resettable>();

export function registerMock<T extends Resettable>(mock: T): T {
  registry.add(mock);
  return mock;
}

/**
 * Restores every registered mock to its creation-time configuration and clears
 * all recorded calls. Call from an `afterEach` hook.
 */
export function resetAllStellarMocks(): void {
  registry.forEach((mock) => {
    mock.reset();
  });
}

export function registeredMockCount(): number {
  return registry.size;
}

/** Drops registry entries entirely. Rarely needed; prefer `resetAllStellarMocks`. */
export function clearStellarMockRegistry(): void {
  registry.clear();
}
