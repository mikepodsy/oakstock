"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchVolatility } from "@/services/options";
import type { VolatilityResponse } from "@/types/volatility";

export function useVolatility(ticker: string | null): {
  data: VolatilityResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<VolatilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  const load = useCallback(async () => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const id = ++token.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVolatility(ticker);
      if (token.current === id) setData(result);
    } catch (e) {
      if (token.current === id) {
        setError(e instanceof Error ? e.message : "Failed to fetch volatility");
      }
    } finally {
      if (token.current === id) setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
