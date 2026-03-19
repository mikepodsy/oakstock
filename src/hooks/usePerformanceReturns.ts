"use client";

import { useState, useEffect } from "react";
import { fetchHistoryBatch } from "@/services/yahooFinance";
import type { PerformanceReturns, PerformancePeriod } from "@/types";

const PERIOD_API_MAP: Record<PerformancePeriod, string> = {
  "1M": "1m",
  "3M": "3m",
  "YTD": "ytd",
  "1Y": "1y",
  "3Y": "3y",
  "5Y": "5y",
};

const PERIODS = Object.keys(PERIOD_API_MAP) as PerformancePeriod[];

export function usePerformanceReturns(
  ticker: string,
  currentPrice: number
): { returns: PerformanceReturns | null; loading: boolean } {
  const [returns, setReturns] = useState<PerformanceReturns | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker || !currentPrice || currentPrice <= 0) {
      setReturns(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function compute() {
      try {
        const apiPeriods = PERIODS.map((p) => PERIOD_API_MAP[p]);
        const batchData = await fetchHistoryBatch(ticker, apiPeriods);

        if (cancelled) return;

        const results: [PerformancePeriod, number | null][] = PERIODS.map((period) => {
          const data = batchData[PERIOD_API_MAP[period]];
          if (!data || data.length === 0) return [period, null];
          const firstClose = data[0].close;
          if (!firstClose || firstClose <= 0) return [period, null];
          return [period, ((currentPrice - firstClose) / firstClose) * 100];
        });

        const map = Object.fromEntries(results) as PerformanceReturns;
        setReturns(map);
      } catch {
        if (!cancelled) setReturns(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    compute();
    return () => { cancelled = true; };
  }, [ticker, currentPrice]);

  return { returns, loading };
}
