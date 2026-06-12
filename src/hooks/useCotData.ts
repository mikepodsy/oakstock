"use client";

import { useState, useEffect, useCallback } from "react";
import type { CotReport } from "@/types";
import { fetchCotData } from "@/services/cotService";

export function useCotData() {
  const [data, setData] = useState<CotReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCotData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch COT data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
