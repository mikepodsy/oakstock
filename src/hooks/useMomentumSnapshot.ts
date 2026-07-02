"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Sp400Response, StoredMomentum } from "@/app/api/alerts/sp400/route";
import { isSnapshotStale } from "@/utils/refreshSchedule";

/**
 * Reads a precomputed momentum snapshot from `readPath` and can kick off a bulk
 * recompute via `refreshPath`. Both the large-cap and ETF panels share this: the
 * two endpoints return the same {@link Sp400Response} shape.
 *
 * `refreshing` covers the on-demand recompute (a GET to `refreshPath`), after
 * which we re-read the snapshot. On mount, if the snapshot predates the last
 * expected daily cron run, one recompute is triggered automatically so
 * dev/preview stay current and any missed cron run is backstopped.
 */
export function useMomentumSnapshot(readPath: string, refreshPath: string) {
  const [statuses, setStatuses] = useState<StoredMomentum[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const autoHealedRef = useRef(false);

  const refetch = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(readPath);
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
  }, [readPath]);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(refreshPath);
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [refreshPath, refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Self-heal: if the snapshot predates the last expected daily refresh, kick off
  // one recompute per mount. The Vercel cron only runs on the production
  // deployment, so this keeps dev/preview current and backstops any missed run.
  useEffect(() => {
    if (autoHealedRef.current || loading || refreshing) return;
    if (!isSnapshotStale(lastUpdated)) return;
    autoHealedRef.current = true;
    triggerRefresh();
  }, [loading, refreshing, lastUpdated, triggerRefresh]);

  return { statuses, lastUpdated, loading, refreshing, error, refetch, triggerRefresh };
}
