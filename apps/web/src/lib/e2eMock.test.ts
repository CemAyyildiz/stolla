import { afterEach, describe, expect, it, vi } from "vitest";
import { atlasCommunity } from "@/test/fixtures/communities";
import {
  e2eMocksEnabled,
  getE2EBridge,
  getE2ECommunityRegistry,
} from "./e2eMock";

describe("test-only browser mocks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.__STOLLA_E2E__;
  });

  it("requires the explicit test configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MOCKS", "false");
    expect(e2eMocksEnabled()).toBe(false);
  });

  it("fails closed in production even when the public flag is present", () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MOCKS", "true");
    vi.stubEnv("NODE_ENV", "production");
    window.__STOLLA_E2E__ = { communities: [] };
    expect(e2eMocksEnabled()).toBe(false);
    expect(getE2EBridge()).toBeNull();
  });

  it("exposes browser fixtures through the canonical registry adapter", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MOCKS", "true");
    vi.stubEnv("NODE_ENV", "test");
    window.__STOLLA_E2E__ = { communities: [atlasCommunity] };

    const registry = getE2ECommunityRegistry();
    expect(registry).not.toBeNull();
    await expect(registry!.list(null, 10)).resolves.toMatchObject({
      communities: [atlasCommunity],
      nextCursor: null,
    });
    await expect(registry!.get(atlasCommunity.record.id)).resolves.toEqual({
      status: "found",
      community: atlasCommunity,
    });
  });
});
