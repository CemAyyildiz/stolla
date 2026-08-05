"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SubmissionGuardRunResult<T> =
  | { started: false }
  | { started: true; value: T };

/**
 * Operation-scoped in-flight guard that blocks double clicks / repeated Enter
 * before React re-renders disabled state.
 */
export function useSubmissionGuard() {
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async <T,>(
      operation: () => Promise<T>,
    ): Promise<SubmissionGuardRunResult<T>> => {
      if (inFlightRef.current) {
        return { started: false };
      }

      inFlightRef.current = true;
      if (mountedRef.current) {
        setIsPending(true);
      }

      try {
        const value = await operation();
        return { started: true, value };
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setIsPending(false);
        }
      }
    },
    [],
  );

  return {
    isPending,
    run,
  };
}
