import { describe, expect, it, vi } from "vitest";
import { runTransactionLifecycle } from "@/lib/runTransactionLifecycle";
import type { TransactionLifecycleStage } from "@/lib/transactionLifecycle";

function trackStages() {
  const stages: TransactionLifecycleStage[] = [];
  return {
    stages,
    onStage(stage: TransactionLifecycleStage) {
      stages.push(stage);
    },
  };
}

describe("runTransactionLifecycle", () => {
  it("shows approval, submission, and confirmation before success", async () => {
    const { stages, onStage } = trackStages();
    const sign = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue({ status: "SUCCESS" });

    const result = await runTransactionLifecycle({
      assemble: async () => ({ sign, send }),
      onStage,
    });

    expect(result).toEqual({ ok: true });
    expect(stages).toEqual([
      "simulating",
      "awaiting_approval",
      "submitting",
      "confirming",
      "success",
    ]);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps wallet rejection distinct", async () => {
    const { stages, onStage } = trackStages();
    const result = await runTransactionLifecycle({
      assemble: async () => ({
        sign: async () => {
          throw new Error("User rejected the request");
        },
        send: vi.fn(),
      }),
      onStage,
    });

    expect(result).toEqual({
      ok: false,
      kind: "wallet_rejected",
      message: "User rejected the request",
    });
    expect(stages.at(-1)).toBe("failure");
    expect(stages).toContain("awaiting_approval");
    expect(stages).not.toContain("confirming");
  });

  it("keeps send failure distinct", async () => {
    const { onStage } = trackStages();
    const result = await runTransactionLifecycle({
      assemble: async () => ({
        sign: async () => undefined,
        send: async () => {
          throw new Error("RPC send failed");
        },
      }),
      onStage,
    });

    expect(result).toEqual({
      ok: false,
      kind: "send_failed",
      message: "RPC send failed",
    });
  });

  it("keeps still-pending timeout outcomes distinct", async () => {
    const { onStage } = trackStages();
    const result = await runTransactionLifecycle({
      assemble: async () => ({
        sign: async () => undefined,
        send: async () => {
          throw new Error("Transaction timed out while still pending");
        },
      }),
      onStage,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.kind).toBe("still_pending");
    expect(result.message).toMatch(/still pending/i);
  });

  it("falls back to signAndSend when granular methods are missing", async () => {
    const { stages, onStage } = trackStages();
    const signAndSend = vi.fn().mockResolvedValue({ status: "SUCCESS" });

    const result = await runTransactionLifecycle({
      assemble: async () => ({ signAndSend }),
      onStage,
    });

    expect(result).toEqual({ ok: true });
    expect(signAndSend).toHaveBeenCalledTimes(1);
    expect(stages).toEqual([
      "simulating",
      "awaiting_approval",
      "submitting",
      "confirming",
      "success",
    ]);
  });
});
