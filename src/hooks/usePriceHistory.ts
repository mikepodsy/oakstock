"use client";

import { useEffect, useState } from "react";
import type { HistoricalDataPoint } from "@/types";
import { fetchHistory } from "@/services/yahooFinance";

interface FetchState {
  /** `TICKER:PERIOD` the points belong to — "" before the first result. */
  key: string;
  points: HistoricalDataPoint[];
}

/**
 * Daily/weekly closes for a symbol over a named period.
 *
 * Same key-derived `loading` as useAnalystRating: state is only written inside
 * the async continuation, never synchronously in the effect body.
 */
export function usePriceHistory(
  ticker: string | null,
  period: string
): { history: HistoricalDataPoint[]; loading: boolean } {
  const [state, setState] = useState<FetchState>({ key: "", points: [] });
  const key = ticker ? `${ticker}:${period}` : "";

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    (async () => {
      try {
        const points = await fetchHistory(ticker, period);
        if (!cancelled) setState({ key, points });
      } catch {
        // An empty series is the right fallback: the chart that consumes this
        // already renders its own "not enough history" state.
        if (!cancelled) setState({ key, points: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, period, key]);

  const settled = key !== "" && state.key === key;
  return {
    history: settled ? state.points : [],
    loading: key !== "" && !settled,
  };
}
