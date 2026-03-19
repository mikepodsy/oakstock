"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PortfolioChartPoint } from "@/types";
import { fetchHistory } from "@/services/yahooFinance";

interface HoldingInput {
  ticker: string;
  shares: number;
}

const VALID_PERIODS = ["1d", "1w", "1m", "3m", "6m", "1y", "max"];

export function usePortfolioHistory(
  holdings: HoldingInput[],
  benchmark: string,
  period: string,
  totalCost: number
) {
  const [data, setData] = useState<PortfolioChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validPeriod = VALID_PERIODS.includes(period) ? period : "1y";

  // Stable key for dependency tracking
  const holdingsKey = useMemo(
    () =>
      holdings
        .map((h) => `${h.ticker}:${h.shares}`)
        .sort()
        .join(","),
    [holdings]
  );

  const fetchData = useCallback(async () => {
    if (holdings.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all holding histories + benchmark in parallel
      const tickers = holdings.map((h) => h.ticker);
      const allTickers = [...tickers, benchmark];

      const results = await Promise.allSettled(
        allTickers.map((t) => fetchHistory(t, validPeriod))
      );

      // Build lookup: ticker -> { date -> close }
      const historyMap: Record<string, Record<string, number>> = {};
      for (let i = 0; i < allTickers.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const map: Record<string, number> = {};
          for (const point of result.value) {
            map[point.date] = point.close;
          }
          historyMap[allTickers[i]] = map;
        }
      }

      // Collect all unique dates (union approach)
      const dateSet = new Set<string>();
      for (const ticker of tickers) {
        const tickerHistory = historyMap[ticker];
        if (tickerHistory) {
          for (const date of Object.keys(tickerHistory)) {
            dateSet.add(date);
          }
        }
      }

      const sortedDates = Array.from(dateSet).sort();

      if (sortedDates.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Build portfolio value per date
      const benchmarkHistory = historyMap[benchmark];
      const firstDate = sortedDates[0];
      const firstBenchmarkClose = benchmarkHistory?.[firstDate];

      // Compute baseline once (first date's portfolio value for benchmark normalization)
      let firstPortfolioValue = 0;
      for (const h of holdings) {
        const close = historyMap[h.ticker]?.[firstDate];
        if (close !== undefined) {
          firstPortfolioValue += h.shares * close;
        }
      }
      const baseline =
        firstPortfolioValue > 0 ? firstPortfolioValue : totalCost;

      const points: PortfolioChartPoint[] = sortedDates.map((date) => {
        // Sum holding values for this date
        let portfolioValue = 0;
        for (const h of holdings) {
          const close = historyMap[h.ticker]?.[date];
          if (close !== undefined) {
            portfolioValue += h.shares * close;
          }
        }

        // Normalize benchmark to portfolio scale
        let benchmarkValue: number | null = null;
        if (benchmarkHistory && firstBenchmarkClose) {
          const benchClose = benchmarkHistory[date];
          if (benchClose !== undefined) {
            benchmarkValue =
              (benchClose / firstBenchmarkClose) * baseline;
          }
        }

        return {
          date,
          portfolioValue,
          benchmarkValue,
          costBasis: totalCost,
        };
      });

      setData(points);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch history"
      );
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsKey, benchmark, validPeriod, totalCost]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
