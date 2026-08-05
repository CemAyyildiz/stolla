import { describe, expect, it } from "vitest";
import { parseProposalId } from "./proposals";

describe("parseProposalId", () => {
  it("parses a valid 64-character hex proposal ID into 32 bytes", () => {
    const id = "ab".repeat(32);
    const buffer = parseProposalId(id);
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBe(32);
    expect(buffer!.toString("hex")).toBe(id);
  });

  it("accepts uppercase hexadecimal IDs", () => {
    const buffer = parseProposalId("AB".repeat(32));
    expect(buffer).not.toBeNull();
    expect(buffer!.toString("hex")).toBe("ab".repeat(32));
  });

  it("rejects non-hexadecimal values", () => {
    expect(parseProposalId("zz".repeat(32))).toBeNull();
    expect(parseProposalId(`0x${"ab".repeat(31)}`)).toBeNull();
  });

  it("rejects empty and missing values", () => {
    expect(parseProposalId("")).toBeNull();
    expect(parseProposalId(undefined)).toBeNull();
  });

  it("rejects truncated IDs", () => {
    expect(parseProposalId("ab".repeat(16))).toBeNull();
    expect(parseProposalId("a")).toBeNull();
    expect(parseProposalId(`${"ab".repeat(31)}a`)).toBeNull();
  });

  it("rejects oversized IDs", () => {
    expect(parseProposalId("ab".repeat(33))).toBeNull();
  });
});
