"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalystData } from "@/types";
import { fetchAnalyst } from "@/services/yahooFinance";
import { analystRating, analystScore } from "@/utils/analystRating";
import type { Rating } from "@/utils/rating";

interface FetchState {
  /** `TICKER:NONCE` the data belongs to — "" before the first result. */
  key: string;
  data: AnalystData | null;
  failed: boolean;
}

const EMPTY: FetchState = { key: "", data: null, failed: false };

export interface AnalystRatingResult {
  data: AnalystData | null;
  /** −1…1 consensus, or null when nobody covers the symbol. */
  score: number | null;
  rating: Rating | null;
  loading: boolean;
  /**
   * Why there's no rating, when there isn't one:
   * - "fetch"    — the request failed. Retryable.
   * - "coverage" — Yahoo answered, but no analyst follows this symbol. Normal
   *   for ETFs, indices and most non-US listings; retrying won't help.
   */
  reason: "fetch" | "coverage" | null;
  retry: () => void;
}

/**
 * Analyst consensus, price target and EPS estimates for a symbol.
 *
 * Unlike the technical rating this takes no interval — sell-side consensus is
 * the same number whichever candle size you happen to be looking at.
 *
 * `loading` is derived by comparing the requested key against the one the state
 * holds, rather than being flipped on before the request, which keeps every
 * state write inside the async continuation.
 */
export function useAnalystRating(ticker: string | null): AnalystRatingResult {
  const [state, setState] = useState<FetchState>(EMPTY);
  // Bumping this changes the key, which re-runs the effect — that's the retry.
  const [nonce, setNonce] = useState(0);
  const key = ticker ? `${ticker}:${nonce}` : "";

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAnalyst(ticker);
        if (!cancelled) setState({ key, data, failed: false });
      } catch {
        if (!cancelled) setState({ key, data: null, failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, key]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const settled = key !== "" && state.key === key;
  const data = settled ? state.data : null;

  const score = useMemo(
    () => (data ? analystScore(data.consensusMean, data.distribution) : null),
    [data]
  );
  const rating = useMemo(
    () => (data ? analystRating(data.consensusMean, data.distribution) : null),
    [data]
  );

  return {
    data,
    score,
    rating,
    loading: key !== "" && !settled,
    reason: !settled || rating ? null : state.failed ? "fetch" : "coverage",
    retry,
  };
}
