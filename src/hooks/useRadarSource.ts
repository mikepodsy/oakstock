"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RADAR_SECTORS,
  RADAR_RANKING_LIMIT,
  type RadarRanking,
} from "@/utils/constants";
import { radarSourceMode } from "@/utils/radarRanking";
import {
  fetchScreener,
  fetchTrending,
  fetchRadarMovers,
} from "@/services/yahooFinance";

interface RadarSource {
  tickers: string[];
  /** Period % return per ticker, when the list was ranked server-side. */
  changes: Record<string, number>;
  loading: boolean;
  error: string | null;
  /** Universe coverage while a period ranking is still converging. */
  progress: { covered: number; total: number } | null;
}

// A cold full-universe ranking takes a few passes; this bounds the loop so a
// permanently-incomplete response can't poll forever.
const MAX_MOVER_PASSES = 8;

/**
 * Resolves which ticker symbols the Radar should show, given the selected
 * sector, ranking and timeframe.
 *
 * - Trending → Yahoo market-wide trending list (remote)
 * - Gainers/Losers on **Today** → Yahoo's market-wide day screener (remote)
 * - Gainers/Losers on any **other timeframe** → our universe ranked by that
 *   period's actual return (remote; Yahoo has no weekly/monthly screener)
 * - Otherwise → the sector's static list, capped for "All Companies"
 */
export function useRadarSource(
  sector: string,
  ranking: RadarRanking,
  timeframe: string
): RadarSource {
  const [remote, setRemote] = useState<string[]>([]);
  const [changes, setChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ covered: number; total: number } | null>(
    null
  );
  const reqRef = useRef(0);

  const mode = useMemo(
    () => radarSourceMode({ sector, ranking, timeframe }),
    [sector, ranking, timeframe]
  );
  // Stable key so the effect only refires when the remote request changes
  const remoteKey =
    mode.kind === "trending"
      ? "trending"
      : mode.kind === "screener"
        ? `screener:${mode.screener}`
        : mode.kind === "movers"
          ? `movers:${mode.sector}:${mode.direction}:${mode.period}`
          : "";

  const load = useCallback(async () => {
    if (mode.kind === "static") {
      setRemote([]);
      setChanges({});
      setError(null);
      setProgress(null);
      setLoading(false);
      return;
    }

    const id = ++reqRef.current;
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      if (mode.kind === "trending") {
        const symbols = await fetchTrending(RADAR_RANKING_LIMIT);
        if (reqRef.current === id) {
          setRemote(symbols);
          setChanges({});
        }
        return;
      }

      if (mode.kind === "screener") {
        const symbols = await fetchScreener(mode.screener, RADAR_RANKING_LIMIT);
        if (reqRef.current === id) {
          setRemote(symbols);
          setChanges({});
        }
        return;
      }

      // Period ranking: each pass resolves more of the universe and returns the
      // best-so-far, so the list is shown as it converges rather than blocking.
      for (let pass = 0; pass < MAX_MOVER_PASSES; pass++) {
        const result = await fetchRadarMovers(
          mode.sector,
          mode.direction,
          mode.period,
          RADAR_RANKING_LIMIT
        );
        if (reqRef.current !== id) return;

        setRemote(result.ranked.map((r) => r.ticker));
        setChanges(
          Object.fromEntries(result.ranked.map((r) => [r.ticker, r.change]))
        );
        setProgress({ covered: result.covered, total: result.universeSize });

        if (result.complete) {
          setProgress(null);
          return;
        }
      }
    } catch (err) {
      if (reqRef.current === id) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setRemote([]);
        setChanges({});
        setProgress(null);
      }
    } finally {
      if (reqRef.current === id) setLoading(false);
    }
  }, [remoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const staticTickers = useMemo(() => {
    if (mode.kind !== "static") return [];
    const tickers = RADAR_SECTORS[mode.sector]?.tickers ?? [];
    return mode.cap ? tickers.slice(0, mode.cap) : tickers;
  }, [mode]);

  if (mode.kind === "static") {
    return {
      tickers: staticTickers,
      changes: {},
      loading: false,
      error: null,
      progress: null,
    };
  }
  return { tickers: remote, changes, loading, error, progress };
}
