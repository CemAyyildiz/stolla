import { describe, it } from "vitest";
import { stellarMockExamples } from "./examples";

describe("stellar contract mocks", () => {
  Object.keys(stellarMockExamples).forEach((name) => {
    it(name, () => stellarMockExamples[name]());
  });
});
