"use client";

import { useState, useEffect, useMemo } from "react";
import type { DividendHolding, MonthlyIncome } from "@/types";
import { fetchDividendIncome } from "@/services/yahooFinance";

export function useDividendIncome(
  holdings: DividendHolding[],
  earliestDates: Record<string, string> // ticker → earliest purchase date
) {
  const [rawIncome, setRawIncome] = useState<
    Record<string, { date: string; dividend: number }[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickers = useMemo(
    () => holdings.map((h) => h.ticker),
    [holdings]
  );

  const globalFrom = useMemo(() => {
    const dates = Object.values(earliestDates);
    if (dates.length === 0) return new Date().toISOString().split("T")[0];
    return dates.sort()[0];
  }, [earliestDates]);

  useEffect(() => {
    if (tickers.length === 0) {
      setRawIncome({});
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDividendIncome(tickers, globalFrom);
        if (!cancelled) setRawIncome(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load income data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tickers, globalFrom]);

  const monthlyIncome = useMemo<MonthlyIncome[]>(() => {
    const sharesMap = new Map<string, number>();
    for (const h of holdings) {
      sharesMap.set(h.ticker, (sharesMap.get(h.ticker) ?? 0) + h.totalShares);
    }

    const monthMap = new Map<string, Map<string, number>>();

    for (const [ticker, payments] of Object.entries(rawIncome)) {
      const shares = sharesMap.get(ticker) ?? 0;
      const purchaseDate = earliestDates[ticker] ?? "";

      for (const payment of payments) {
        if (payment.date < purchaseDate) continue;

        const month = payment.date.slice(0, 7); // "2024-03"
        const received = payment.dividend * shares;

        if (!monthMap.has(month)) monthMap.set(month, new Map());
        const tickerMap = monthMap.get(month)!;
        tickerMap.set(ticker, (tickerMap.get(ticker) ?? 0) + received);
      }
    }

    return Array.from(monthMap.entries())
      .map(([month, tickerMap]) => ({
        month,
        totalIncome: Array.from(tickerMap.values()).reduce((a, b) => a + b, 0),
        byTicker: Array.from(tickerMap.entries()).map(([ticker, amount]) => ({
          ticker,
          amount,
        })),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [rawIncome, holdings, earliestDates]);

  const totalReceived = useMemo(
    () => monthlyIncome.reduce((sum, m) => sum + m.totalIncome, 0),
    [monthlyIncome]
  );

  return { monthlyIncome, totalReceived, loading, error };
}
