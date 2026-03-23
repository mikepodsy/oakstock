"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuoteData } from "@/types";
import { fetchQuotes } from "@/services/yahooFinance";

export function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickerKey = tickers.sort().join(",");

  const refetch = useCallback(async () => {
    if (tickers.length === 0) {
      setQuotes({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuotes(tickers);
      const map: Record<string, QuoteData> = {};
      for (const q of data) {
        map[q.ticker] = q;
      }
      setQuotes(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quotes");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (tickers.length === 0) return;
    const interval = setInterval(refetch, 300_000);
    return () => clearInterval(interval);
  }, [refetch, tickers.length]);

  return { quotes, loading, error, refetch };
}
