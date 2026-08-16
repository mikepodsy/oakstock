"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBacktestRuns } from "@/services/backtestService";
import type { BacktestRun } from "@/types/backtest";

export function useBacktestRuns() {
  const [data, setData] = useState<BacktestRun[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBacktestRuns(signal);
      if (signal?.aborted) return;
      setData(result);
    } catch (err) {
      // Swallow the abort: it's an intentional cancellation, not a fetch error.
      if (
        signal?.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      )
        return;
      setError(err instanceof Error ? err.message : "Failed to fetch runs");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { data, loading, error, refetch };
}
