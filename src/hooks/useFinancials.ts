"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchFinancials } from "@/services/yahooFinance";
import type { FinancialData } from "@/types";

export function useFinancials(ticker: string | null): {
  data: FinancialData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<FinancialData | null>(null);
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
      const result = await fetchFinancials(ticker);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch financials");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
