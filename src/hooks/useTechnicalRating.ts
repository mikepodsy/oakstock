"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { QuestradeCandle } from "@/types";
import { fetchQuestradeCandles } from "@/services/questrade";
import { computeTechnicalRating } from "@/utils/technicalRating";

interface FetchState {
  /** `TICKER:INTERVAL:NONCE` the candles belong to — "" before the first result. */
  key: string;
  candles: QuestradeCandle[];
  failed: boolean;
}

const EMPTY: FetchState = { key: "", candles: [], failed: false };

export interface TechnicalRatingResult {
  rating: ReturnType<typeof computeTechnicalRating>;
  loading: boolean;
  /**
   * Why there's no rating, when there isn't one:
   * - "fetch"  — the candles request failed (Questrade can't resolve the
   *   symbol, or the request errored). Retryable.
   * - "history" — candles came back, but too few to compute anything.
   *
   * Keeping these apart matters: reporting a failed request as "not enough
   * history" sends you looking at the wrong problem.
   */
  reason: "fetch" | "history" | null;
  retry: () => void;
}

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
export function useTechnicalRating(
  ticker: string | null,
  interval: string
): TechnicalRatingResult {
  const [state, setState] = useState<FetchState>(EMPTY);
  // Bumping this changes the key, which re-runs the effect — that's the retry.
  const [nonce, setNonce] = useState(0);
  const key = ticker ? `${ticker}:${interval}:${nonce}` : "";

  useEffect(() => {
    // No symbol: nothing to fetch, and nothing to clear either — the returned
    // values are already gated on the key matching what was asked for.
    if (!ticker) return;

    let cancelled = false;
    (async () => {
      try {
        const candles = await fetchQuestradeCandles(ticker, interval);
        if (!cancelled) setState({ key, candles, failed: false });
      } catch {
        if (!cancelled) setState({ key, candles: [], failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, interval, key]);

  const rating = useMemo(
    () => computeTechnicalRating(state.candles),
    [state.candles]
  );

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const settled = key !== "" && state.key === key;
  const loading = key !== "" && !settled;

  return {
    rating: settled ? rating : null,
    loading,
    reason: !settled || rating ? null : state.failed ? "fetch" : "history",
    retry,
  };
}
