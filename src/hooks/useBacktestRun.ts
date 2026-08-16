"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBacktestRun } from "@/services/backtestService";
import type { BacktestDetail } from "@/types/backtest";

/** Detail for one saved run. Pass null to hold off fetching. */
export function useBacktestRun(runId: string | null) {
  const [data, setData] = useState<BacktestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchBacktestRun(id, signal);
        if (signal?.aborted) return;
        setData(result);
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        )
          return;
        setError(err instanceof Error ? err.message : "Failed to fetch run");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!runId) {
      setData(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    load(runId, controller.signal);
    return () => controller.abort();
  }, [runId, load]);

  const refetch = useCallback(() => {
    if (runId) load(runId);
  }, [runId, load]);

  return { data, loading, error, refetch };
}
