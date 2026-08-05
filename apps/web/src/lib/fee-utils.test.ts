import { describe, expect, it } from "vitest";
import { stroopsToXlm, xlmToStroops, formatFeeBreakdown } from "./fee-utils";

describe("stroopsToXlm", () => {
  it("converts 0 stroops", () => {
    expect(stroopsToXlm(0)).toBe("0");
  });

  it("converts exactly 1 XLM", () => {
    expect(stroopsToXlm(10_000_000)).toBe("1");
  });

  it("converts 5 XLM", () => {
    expect(stroopsToXlm(50_000_000)).toBe("5");
  });

  it("converts fractional stroops", () => {
    expect(stroopsToXlm(12_345_678)).toBe("1.2345678");
  });

  it("drops trailing zeros", () => {
    expect(stroopsToXlm(10_000_000)).toBe("1");
    expect(stroopsToXlm(20_000_000)).toBe("2");
  });

  it("handles large values without overflow", () => {
    const result = stroopsToXlm("10000000000000000000000");
    expect(result).toBe("1000000000000000");
  });

  it("handles BigInt input", () => {
    expect(stroopsToXlm(10_000_000n)).toBe("1");
  });

  it("handles string input", () => {
    expect(stroopsToXlm("10000000")).toBe("1");
  });
});

describe("xlmToStroops", () => {
  it("converts 1 XLM to stroops", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
  });

  it("converts 0.5 XLM", () => {
    expect(xlmToStroops("0.5")).toBe(5_000_000n);
  });

  it("converts fractional XLM", () => {
    expect(xlmToStroops("1.2345678")).toBe(12_345_678n);
  });

  it("converts without decimal", () => {
    expect(xlmToStroops("5")).toBe(50_000_000n);
  });

  it("round-trips correctly", () => {
    const original = 12_345_678n;
    const xlm = stroopsToXlm(original);
    expect(xlmToStroops(xlm)).toBe(original);
  });
});

describe("formatFeeBreakdown", () => {
  it("formats a simulation result", () => {
    const breakdown = formatFeeBreakdown({
      resourceFee: 12_340_000n,
      cpuInstructions: 500_000n,
      readBytes: 2048n,
      writeBytes: 512n,
      transactionSizeBytes: 1024n,
    });

    expect(breakdown).toEqual({
      stroops: "12340000",
      xlm: "1.234",
      cpu: "500000",
      readBytes: "2048",
      writeBytes: "512",
    });
  });

  it("handles zero values", () => {
    const breakdown = formatFeeBreakdown({
      resourceFee: 0n,
      cpuInstructions: 0n,
      readBytes: 0n,
      writeBytes: 0n,
      transactionSizeBytes: 0n,
    });

    expect(breakdown.xlm).toBe("0");
    expect(breakdown.cpu).toBe("0");
  });
});
