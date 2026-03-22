"use client";

import { useState, useEffect, useCallback } from "react";
import type { TreasuryBundleData, EconomicTimeRange } from "@/types";
import { fetchTreasuryData } from "@/services/economicService";

export function useTreasuryData(range: EconomicTimeRange) {
  const [data, setData] = useState<TreasuryBundleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTreasuryData(range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch treasury data");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const interval = setInterval(refetch, 900_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, loading, error, refetch };
}
