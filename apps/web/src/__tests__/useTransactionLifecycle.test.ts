import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTransactionLifecycle } from "@/hooks/useTransactionLifecycle";

describe("useTransactionLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    expect(result.current.state.stage).toBe("idle");
    expect(result.current.state.voteType).toBeNull();
    expect(result.current.state.reason).toBe("");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isTerminal).toBe(false);
  });

  it("transitions through stages and confirms", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        // Successful transaction
      });
    });

    expect(result.current.state.stage).toBe("confirmed");
    expect(result.current.state.voteType).toBe(1);
    expect(result.current.state.reason).toBe("Support");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("handles wallet rejection", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "test", async () => {
        throw new Error("User rejected the transaction");
      });
    });

    expect(result.current.state.stage).toBe("wallet_rejected");
    expect(result.current.state.error).toBe("User rejected the transaction");
    expect(result.current.state.isTerminal).toBe(true);
    expect(result.current.state.voteType).toBe(1);
    expect(result.current.state.reason).toBe("test");
  });

  it("handles wallet declined", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(0, "disagree", async () => {
        throw new Error("User declined to sign");
      });
    });

    expect(result.current.state.stage).toBe("wallet_rejected");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("handles duplicate vote (AlreadyVoted)", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        throw new Error("AlreadyVoted: account has already voted on this proposal");
      });
    });

    expect(result.current.state.stage).toBe("duplicate_vote");
    expect(result.current.state.error).toBe("You have already voted on this proposal.");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("handles duplicate vote error code 5016", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(2, "Abstain", async () => {
        throw new Error("Error 5016: AlreadyVoted");
      });
    });

    expect(result.current.state.stage).toBe("duplicate_vote");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("handles simulation failure", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        throw new Error("Simulation failed: insufficient resources");
      });
    });

    expect(result.current.state.stage).toBe("simulation_failed");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("handles generic submission failure and preserves reason for retry", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Needs more review", async () => {
        throw new Error("Network timeout");
      });
    });

    expect(result.current.state.stage).toBe("submission_failed");
    expect(result.current.state.error).toBe("Network timeout");
    expect(result.current.state.isTerminal).toBe(true);
    // Reason is preserved for retry
    expect(result.current.state.reason).toBe("Needs more review");
    expect(result.current.state.voteType).toBe(1);
  });

  it("resets state correctly", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    // First execute a failed transaction
    await act(async () => {
      await result.current.execute(1, "test", async () => {
        throw new Error("Failed");
      });
    });

    expect(result.current.state.stage).toBe("submission_failed");

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.state.stage).toBe("idle");
    expect(result.current.state.voteType).toBeNull();
    expect(result.current.state.reason).toBe("");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isTerminal).toBe(false);
  });

  it("calls onConfirmed callback after successful transaction", async () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() =>
      useTransactionLifecycle({ onConfirmed }),
    );

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        // Successful transaction
      });
    });

    expect(result.current.state.stage).toBe("confirmed");
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("supports all three vote types", async () => {
    const voteTypes = [
      { type: 1, label: "For" },
      { type: 0, label: "Against" },
      { type: 2, label: "Abstain" },
    ];

    for (const { type } of voteTypes) {
      const { result } = renderHook(() => useTransactionLifecycle());

      await act(async () => {
        await result.current.execute(type, "test reason", async () => {
          // Success
        });
      });

      expect(result.current.state.stage).toBe("confirmed");
      expect(result.current.state.voteType).toBe(type);
    }
  });

  it("preserves vote details through failed lifecycle", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(0, "Disagree with proposal", async () => {
        throw new Error("Wallet closed by user");
      });
    });

    // Vote type and reason are preserved even in failed state
    expect(result.current.state.voteType).toBe(0);
    expect(result.current.state.reason).toBe("Disagree with proposal");
  });

  it("detects denied error as wallet rejection", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        throw new Error("Transaction denied by user");
      });
    });

    expect(result.current.state.stage).toBe("wallet_rejected");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("detects cancel error as wallet rejection", async () => {
    const { result } = renderHook(() => useTransactionLifecycle());

    await act(async () => {
      await result.current.execute(1, "Support", async () => {
        throw new Error("User cancelled signing");
      });
    });

    expect(result.current.state.stage).toBe("wallet_rejected");
    expect(result.current.state.isTerminal).toBe(true);
  });

  it("ignores a second execute while the first is still in flight", async () => {
    const gate = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();
    const fn = vi.fn().mockReturnValue(gate.promise);
    const { result } = renderHook(() => useTransactionLifecycle());

    let first!: { started: boolean };
    let second!: { started: boolean };

    await act(async () => {
      const firstPromise = result.current.execute(1, "Support", fn);
      const secondPromise = result.current.execute(0, "Against", fn);
      second = await secondPromise;
      gate.resolve();
      first = await firstPromise;
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ started: true });
    expect(second).toEqual({ started: false });
    expect(result.current.state.voteType).toBe(1);
    expect(result.current.state.stage).toBe("confirmed");
    expect(result.current.isInFlight).toBe(false);
  });
});
