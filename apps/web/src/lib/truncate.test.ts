import { describe, expect, it } from "vitest";
import { truncateEnd, truncateMiddle } from "@/lib/truncate";

describe("truncateMiddle", () => {
  it("preserves short values", () => {
    expect(truncateMiddle("GABC1234")).toBe("GABC1234");
  });

  it("keeps the requested start and end of a long value", () => {
    expect(truncateMiddle("GABCDEFGHIJKLMNOPQRSTUVWXYZ", 6, 4)).toBe(
      "GABCDE…WXYZ",
    );
  });
});

describe("truncateEnd", () => {
  it("preserves values within the limit", () => {
    expect(truncateEnd("abc", 3)).toBe("abc");
  });

  it("keeps the requested prefix of a long value", () => {
    expect(truncateEnd("0123456789abcdef", 8)).toBe("01234567…");
  });
});
