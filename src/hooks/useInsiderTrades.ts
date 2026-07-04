"use client";

import { useState, useEffect } from "react";
import type { InsiderTrade } from "@/lib/finviz/insiderTrading";

export function useInsiderTrades(ticker: string | null): {
  trades: InsiderTrade[];
  loading: boolean;
  error: string | null;
} {
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setTrades([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/insider-trading/${encodeURIComponent(ticker)}`,
        );
        if (!res.ok) throw new Error(`Failed to fetch insider trades`);
        const json = await res.json();
        if (!cancelled) setTrades(json.trades ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch");
          setTrades([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return { trades, loading, error };
}
