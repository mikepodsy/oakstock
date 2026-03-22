"use client";

import { useState, useEffect, useCallback } from "react";
import type { MarketIndicator, EconomicIndicatorData, EconomicTimeRange } from "@/types";
import { fetchMarketData } from "@/services/economicService";

export function useMarketData(symbol: MarketIndicator, range: EconomicTimeRange) {
  const [data, setData] = useState<EconomicIndicatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketData(symbol, range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const interval = setInterval(refetch, 900_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, loading, error, refetch };
}
