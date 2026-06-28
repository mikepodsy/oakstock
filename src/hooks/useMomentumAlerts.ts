"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MomentumStatus } from "@/utils/momentum";

interface MomentumResponse {
  statuses: MomentumStatus[];
  errors: { ticker: string; detail: string }[];
}

/**
 * Fetches Mag 7 momentum statuses from /api/alerts/momentum and auto-refreshes
 * every 5 minutes while the page is mounted. Mirrors the useQuotes pattern.
 */
export function useMomentumAlerts() {
  const [statuses, setStatuses] = useState<MomentumStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/alerts/momentum");
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as MomentumResponse;
      if (fetchIdRef.current !== fetchId) return;
      setStatuses(data.statuses ?? []);
    } catch (err) {
      if (fetchIdRef.current === fetchId) {
        setError(err instanceof Error ? err.message : "Failed to fetch alerts");
      }
    } finally {
      if (fetchIdRef.current === fetchId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh every 5 minutes.
  useEffect(() => {
    const interval = setInterval(refetch, 300_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { statuses, loading, error, refetch };
}
