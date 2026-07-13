"use client";

import { useMemo } from "react";
import { useQuotes } from "@/hooks/useQuotes";
import { useRadarReturns } from "@/hooks/useRadarReturns";
import type { Watchlist } from "@/types";

export type WatchlistPeriod = "1D" | "1W" | "1M" | "YTD" | "1Y";

export const WATCHLIST_PERIODS: WatchlistPeriod[] = ["1D", "1W", "1M", "YTD", "1Y"];

export type WatchlistReturns = Record<WatchlistPeriod, number | null>;

/**
 * Equal-weighted average of the values present for `tickers`. Tickers with no
 * entry in `byTicker` are excluded from the average (not counted as zero).
 * Returns `null` when none of the tickers have a value.
 */
export function averageReturns(
  tickers: string[],
  byTicker: Record<string, number>
): number | null {
  let sum = 0;
  let count = 0;
  for (const ticker of tickers) {
    const value = byTicker[ticker];
    if (value != null && Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

/**
 * Computes each watchlist's equal-weighted aggregate return across the five
 * timeframes shown on the watchlist tabs. Today (1D) comes from the live quote's
 * day change; the longer periods come from the cached, batched Radar returns
 * endpoint. All watchlists' tickers are fetched together so every tab fills in.
 */
export function useWatchlistPerformance(watchlists: Watchlist[]): {
  perf: Record<string, WatchlistReturns>;
  loading: boolean;
} {
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    for (const w of watchlists) {
      for (const item of w.items) set.add(item.ticker);
    }
    return [...set];
  }, [watchlists]);

  const { quotes, loading: quotesLoading } = useQuotes(allTickers);
  const week = useRadarReturns(allTickers, "1w");
  const month = useRadarReturns(allTickers, "1m");
  const ytd = useRadarReturns(allTickers, "ytd");
  const year = useRadarReturns(allTickers, "1y");

  const byTicker1D = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [ticker, quote] of Object.entries(quotes)) {
      if (quote.dayChangePercent != null) map[ticker] = quote.dayChangePercent;
    }
    return map;
  }, [quotes]);

  const perf = useMemo(() => {
    const result: Record<string, WatchlistReturns> = {};
    for (const w of watchlists) {
      const tickers = w.items.map((i) => i.ticker);
      result[w.id] = {
        "1D": averageReturns(tickers, byTicker1D),
        "1W": averageReturns(tickers, week.returns),
        "1M": averageReturns(tickers, month.returns),
        YTD: averageReturns(tickers, ytd.returns),
        "1Y": averageReturns(tickers, year.returns),
      };
    }
    return result;
  }, [watchlists, byTicker1D, week.returns, month.returns, ytd.returns, year.returns]);

  const loading =
    quotesLoading || week.loading || month.loading || ytd.loading || year.loading;

  return { perf, loading };
}
