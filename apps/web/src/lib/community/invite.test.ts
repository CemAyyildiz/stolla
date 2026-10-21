import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCommunityInvitePath, buildCommunityInviteUrl, hasInviteIntent } from "./invite";

const here = dirname(fileURLToPath(import.meta.url));

const COMMUNITY_ID = "ab".repeat(32);

describe("buildCommunityInvitePath", () => {
  it("builds the canonical invite path", () => {
    expect(buildCommunityInvitePath(COMMUNITY_ID)).toBe(`/communities/${COMMUNITY_ID}?invite=1`);
  });

  it("URL-encodes the community id", () => {
    expect(buildCommunityInvitePath("has space")).toBe("/communities/has%20space?invite=1");
  });
});

describe("buildCommunityInviteUrl", () => {
  it("joins an absolute origin with the invite path", () => {
    expect(buildCommunityInviteUrl(COMMUNITY_ID, "https://stolla.example")).toBe(
      `https://stolla.example/communities/${COMMUNITY_ID}?invite=1`,
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(buildCommunityInviteUrl(COMMUNITY_ID, "https://stolla.example/")).toBe(
      `https://stolla.example/communities/${COMMUNITY_ID}?invite=1`,
    );
  });
});

describe("hasInviteIntent", () => {
  it("recognizes the invite flag", () => {
    expect(hasInviteIntent("?invite=1")).toBe(true);
    expect(hasInviteIntent("invite=1")).toBe(true);
  });

  it("rejects any value other than exactly \"1\"", () => {
    expect(hasInviteIntent("?invite=true")).toBe(false);
    expect(hasInviteIntent("?invite=0")).toBe(false);
    expect(hasInviteIntent("?invite=")).toBe(false);
  });

  it("rejects an absent flag", () => {
    expect(hasInviteIntent("")).toBe(false);
    expect(hasInviteIntent("?other=1")).toBe(false);
  });

  it("is not fooled by an invite flag combined with unrelated params", () => {
    expect(hasInviteIntent("?q=alpha&invite=1&page=2")).toBe(true);
  });
});

describe("privilege isolation (static guarantee for 'invite never grants owner powers')", () => {
  // The invite flag has exactly one legitimate reader: the banner/link-builder
  // UI. This test reads the actual source of every authorization-sensitive
  // module and asserts none of them reference it, import this module, or
  // reference the query param name — so a future change that tries to wire
  // the invite flag into an auth check fails this test, not just a review.
  const AUTH_SENSITIVE_FILES = [
    "../../components/community/CommunityOwnershipSettings.tsx",
    "../../components/community/GuardianControls.tsx",
    "./ownership.ts",
  ];

  it.each(AUTH_SENSITIVE_FILES)("%s never reads the invite flag or imports lib/community/invite", (relativePath) => {
    const source = readFileSync(resolve(here, relativePath), "utf8");
    expect(source).not.toMatch(/invite/i);
    expect(source).not.toContain("lib/community/invite");
  });
});
