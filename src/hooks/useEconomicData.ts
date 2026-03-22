"use client";

import { useState, useEffect, useCallback } from "react";
import type { EconomicIndicator, EconomicIndicatorData, EconomicTimeRange } from "@/types";
import { fetchEconomicData } from "@/services/economicService";

export function useEconomicData(indicator: EconomicIndicator, range: EconomicTimeRange) {
  const [data, setData] = useState<EconomicIndicatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEconomicData(indicator, range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch economic data");
    } finally {
      setLoading(false);
    }
  }, [indicator, range]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const interval = setInterval(refetch, 900_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, loading, error, refetch };
}
