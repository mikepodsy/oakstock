"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QuoteData } from "@/types";
import { fetchQuotes } from "@/services/yahooFinance";

const CHUNK_SIZE = 30;

export function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  const tickerKey = tickers.sort().join(",");

  const refetch = useCallback(async () => {
    if (tickers.length === 0) {
      setQuotes({});
      return;
    }

    const fetchId = ++abortRef.current;
    setLoading(true);
    setError(null);
    setQuotes({});

    try {
      // Split into chunks and fetch in parallel, merging results as they arrive
      const chunks: string[][] = [];
      for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
        chunks.push(tickers.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          const data = await fetchQuotes(chunk);
          if (abortRef.current !== fetchId) return;
          setQuotes((prev) => {
            const next = { ...prev };
            for (const q of data) {
              next[q.ticker] = q;
            }
            return next;
          });
        })
      );
    } catch (err) {
      if (abortRef.current === fetchId) {
        setError(err instanceof Error ? err.message : "Failed to fetch quotes");
      }
    } finally {
      if (abortRef.current === fetchId) {
        setLoading(false);
      }
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
