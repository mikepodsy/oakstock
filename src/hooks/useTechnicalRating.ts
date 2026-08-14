"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuestradeCandle } from "@/types";
import { fetchQuestradeCandles } from "@/services/questrade";
import { computeTechnicalRating } from "@/utils/technicalRating";

interface FetchState {
  /** `TICKER:INTERVAL` the candles belong to — "" before the first result. */
  key: string;
  candles: QuestradeCandle[];
  error: string | null;
}

const EMPTY: FetchState = { key: "", candles: [], error: null };

/**
 * Technical rating for a symbol on a given candle interval.
 *
 * Hits the same `/api/questrade/candles` route the chart uses, which is TTL
 * cached server-side on `TICKER:INTERVAL`, so charting a symbol and rating it
 * are usually one network fetch and one cache hit.
 *
 * `loading` is derived by comparing the requested key against the one the state
 * holds, rather than being flipped on before the request — that keeps every
 * state write inside the async continuation.
 */
export function useTechnicalRating(ticker: string | null, interval: string) {
  const [state, setState] = useState<FetchState>(EMPTY);
  const key = ticker ? `${ticker}:${interval}` : "";

  useEffect(() => {
    // No symbol: nothing to fetch, and nothing to clear either — the returned
    // values are already gated on the key matching what was asked for.
    if (!ticker) return;

    let cancelled = false;
    (async () => {
      try {
        const candles = await fetchQuestradeCandles(ticker, interval);
        if (!cancelled) setState({ key, candles, error: null });
      } catch {
        if (!cancelled) {
          setState({ key, candles: [], error: "Unable to load technicals" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, interval, key]);

  const rating = useMemo(
    () => (state.candles.length ? computeTechnicalRating(state.candles) : null),
    [state.candles]
  );

  return {
    rating: state.key === key ? rating : null,
    loading: key !== "" && state.key !== key,
    error: state.key === key ? state.error : null,
  };
}
