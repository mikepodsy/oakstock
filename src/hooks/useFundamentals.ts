"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFundamentals } from "@/services/yahooFinance";
import type { FundamentalsData } from "@/types";

export function useFundamentals(ticker: string | null): {
  data: FundamentalsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFundamentals(ticker);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch fundamentals");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
