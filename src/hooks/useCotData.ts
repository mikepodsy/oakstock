"use client";

import { useState, useEffect, useCallback } from "react";
import type { CotReport } from "@/types";
import { fetchCotData } from "@/services/cotService";

export function useCotData() {
  const [data, setData] = useState<CotReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core loader. Accepts an optional AbortSignal so an in-flight request can be
  // cancelled (e.g. on unmount). When aborted, every state update is skipped so
  // we never call setState on an unmounted component.
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCotData(signal);
      if (signal?.aborted) return;
      setData(result);
    } catch (err) {
      // Swallow the abort: it's an intentional cancellation, not a fetch error.
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Failed to fetch COT data");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Fetches COT data once on mount.
  // Cleanup: aborts the in-flight fetch on unmount so its resolution can't
  // update state after the component is gone (prevents the state-update-after-
  // unmount memory leak).
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Exposed for the manual retry button. User-initiated, so it runs without an
  // abort signal and is not tied to component lifecycle.
  const refetch = useCallback(() => load(), [load]);

  return { data, loading, error, refetch };
}
