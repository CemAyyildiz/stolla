import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSubmissionGuard } from "@/hooks/useSubmissionGuard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSubmissionGuard", () => {
  it("invokes the operation only once under rapid repeated activation", async () => {
    const gate = deferred<"done">();
    const operation = vi.fn().mockReturnValue(gate.promise);
    const { result } = renderHook(() => useSubmissionGuard());

    let first!: Awaited<ReturnType<typeof result.current.run>>;
    let second!: Awaited<ReturnType<typeof result.current.run>>;

    await act(async () => {
      const firstPromise = result.current.run(operation);
      const secondPromise = result.current.run(operation);
      second = await secondPromise;
      gate.resolve("done");
      first = await firstPromise;
    });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ started: true, value: "done" });
    expect(second).toEqual({ started: false });
    expect(result.current.isPending).toBe(false);
  });

  it("re-enables after success", async () => {
    const { result } = renderHook(() => useSubmissionGuard());

    await act(async () => {
      await result.current.run(async () => "ok");
    });
    expect(result.current.isPending).toBe(false);

    const again = vi.fn().mockResolvedValue("again");
    await act(async () => {
      await result.current.run(again);
    });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("re-enables after rejection so retries work", async () => {
    const { result } = renderHook(() => useSubmissionGuard());

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });
    expect(result.current.isPending).toBe(false);

    const retry = vi.fn().mockResolvedValue("recovered");
    await act(async () => {
      const outcome = await result.current.run(retry);
      expect(outcome).toEqual({ started: true, value: "recovered" });
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("does not update pending state after unmount", async () => {
    const gate = deferred<"done">();
    const operation = vi.fn().mockReturnValue(gate.promise);
    const { result, unmount } = renderHook(() => useSubmissionGuard());

    let runPromise!: Promise<unknown>;
    await act(async () => {
      runPromise = result.current.run(operation);
    });
    expect(result.current.isPending).toBe(true);

    unmount();
    await act(async () => {
      gate.resolve("done");
      await runPromise;
    });

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
