"use client";

import { useState, useEffect } from "react";
import type { InsiderFeedTrade } from "@/lib/finviz/insiderTrading";

export function useInsiderBuying(): {
  trades: InsiderFeedTrade[];
  loading: boolean;
  error: string | null;
} {
  const [trades, setTrades] = useState<InsiderFeedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/alerts/insider-buying");
        if (!res.ok) throw new Error("Failed to load insider buys");
        const data = await res.json();
        if (!cancelled) setTrades(data.trades ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
          setTrades([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { trades, loading, error };
}
