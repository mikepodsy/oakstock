"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Sp400Response, StoredMomentum } from "@/app/api/alerts/sp400/route";

/**
 * Reads the precomputed large-cap momentum snapshot from /api/alerts/sp400.
 * `refreshing` covers the on-demand bulk recompute kicked off by triggerRefresh
 * (POST-equivalent GET to /api/alerts/refresh), after which we re-read the snapshot.
 */
export function useSp400Momentum() {
  const [statuses, setStatuses] = useState<StoredMomentum[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/sp400");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as Sp400Response;
      if (fetchIdRef.current !== fetchId) return;
      setStatuses(data.statuses ?? []);
      setLastUpdated(data.lastUpdated ?? null);
    } catch (err) {
      if (fetchIdRef.current === fetchId) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (fetchIdRef.current === fetchId) setLoading(false);
    }
  }, []);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/refresh");
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { statuses, lastUpdated, loading, refreshing, error, refetch, triggerRefresh };
}
