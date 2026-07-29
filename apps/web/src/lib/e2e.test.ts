import { describe, expect, it } from "vitest";
import { MOCK_WALLET_ENABLED, isMockWalletEnabled } from "./e2e";

describe("isMockWalletEnabled", () => {
  it("requires the exact flag value", () => {
    expect(isMockWalletEnabled("mock", "development")).toBe(true);
    expect(isMockWalletEnabled("Mock", "development")).toBe(false);
    expect(isMockWalletEnabled("true", "development")).toBe(false);
    expect(isMockWalletEnabled("", "development")).toBe(false);
    expect(isMockWalletEnabled(undefined, "development")).toBe(false);
  });

  it("stays closed in production however the flag is set", () => {
    expect(isMockWalletEnabled("mock", "production")).toBe(false);
    expect(isMockWalletEnabled("mock", undefined)).toBe(true);
  });

  it("is disabled in the unit test environment", () => {
    expect(MOCK_WALLET_ENABLED).toBe(false);
  });
});
