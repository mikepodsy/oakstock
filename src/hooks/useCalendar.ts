"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CalendarType, CalendarEvent } from "@/types";
import { fetchCalendarData } from "@/services/calendarService";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWatchlistStore } from "@/stores/watchlistStore";

export function useCalendar(type: CalendarType, from: string, to: string) {
  const [data, setData] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolios = usePortfolioStore((s) => s.portfolios);
  const watchlists = useWatchlistStore((s) => s.watchlists);

  const userTickers = useMemo(() => {
    const tickers = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) {
        tickers.add(h.ticker.toUpperCase());
      }
    }
    for (const w of watchlists) {
      for (const item of w.items) {
        tickers.add(item.ticker.toUpperCase());
      }
    }
    return tickers;
  }, [portfolios, watchlists]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await fetchCalendarData(type, from, to);
      const flagged = events.map((event) => {
        if ("symbol" in event && event.symbol) {
          return {
            ...event,
            isPortfolioStock: userTickers.has(event.symbol.toUpperCase()),
          };
        }
        return event;
      });
      setData(flagged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch calendar data");
    } finally {
      setLoading(false);
    }
  }, [type, from, to, userTickers]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const interval = setInterval(refetch, 900_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, loading, error, refetch };
}
