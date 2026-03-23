"use client";

import { useState, useEffect } from "react";

export interface MarketTableItem {
  ticker: string;
  name: string;
  price: number;
  dayLow: number | null;
  dayHigh: number | null;
  weekLow52: number | null;
  weekHigh52: number | null;
  currency: string;
  returns: {
    today: number;
    fiveDays: number | null;
    oneMonth: number | null;
    ytd: number | null;
    oneYear: number | null;
    threeYears: number | null;
  };
}

export function useMarketTable(tickers: readonly string[] | string[]) {
  const [data, setData] = useState<MarketTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tickerKey = [...tickers].join(",");

  useEffect(() => {
    if (!tickers.length) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(
      `/api/market-data?tickers=${[...tickers].map(encodeURIComponent).join(",")}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch market data");
        return r.json() as Promise<MarketTableItem[]>;
      })
      .then((items) => {
        const map = new Map(items.map((item) => [item.ticker, item]));
        const ordered = [...tickers]
          .map((t) => map.get(t))
          .filter((x): x is MarketTableItem => x !== undefined);
        setData(ordered);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  return { data, loading, error };
}
