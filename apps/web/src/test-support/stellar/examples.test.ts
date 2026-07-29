import { stellarMockExamples } from "./examples";

/**
 * Registers the mock examples with whichever test runner is present.
 *
 * The globals are declared locally rather than imported so this file compiles
 * while the web workspace still has no runner installed, keeping
 * `npm run build --workspace=web` green. Once Vitest is configured with
 * `globals: true`, these examples run as a normal suite with no edit here.
 */
declare const describe:
  | undefined
  | ((name: string, fn: () => void) => void);
declare const it:
  | undefined
  | ((name: string, fn: () => Promise<void> | void) => void);

if (typeof describe === "function" && typeof it === "function") {
  describe("stellar contract mocks", () => {
    Object.keys(stellarMockExamples).forEach((name) => {
      it(name, () => stellarMockExamples[name]());
    });
  });
}
