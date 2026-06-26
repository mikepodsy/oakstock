"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchRadarReturns } from "@/services/yahooFinance";

const CHUNK_SIZE = 30;

/**
 * Fetches each ticker's % return over the selected Radar timeframe.
 *
 * Returns an empty map (and never fetches) for the "1d" timeframe — the Radar
 * uses the live quote's day change for Today. Tickers are chunked so several
 * requests run in parallel and cards fill in as each chunk resolves.
 */
export function useRadarReturns(tickers: string[], period: string) {
  const [returns, setReturns] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(0);

  const enabled = period !== "1d" && tickers.length > 0;
  const tickerKey = [...tickers].sort().join(",");

  const refetch = useCallback(async () => {
    if (!enabled) {
      setReturns({});
      setLoading(false);
      return;
    }

    const fetchId = ++abortRef.current;
    setLoading(true);
    setReturns({});

    try {
      const chunks: string[][] = [];
      for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
        chunks.push(tickers.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          const data = await fetchRadarReturns(chunk, period);
          if (abortRef.current !== fetchId) return;
          setReturns((prev) => ({ ...prev, ...data }));
        })
      );
    } catch {
      // Swallow — cards fall back to a skeleton/no badge for missing tickers.
    } finally {
      if (abortRef.current === fetchId) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, period, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { returns, loading };
}
