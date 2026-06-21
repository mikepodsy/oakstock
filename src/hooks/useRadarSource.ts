"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RADAR_SECTORS,
  RADAR_ALL_KEY,
  RADAR_ALL_DEFAULT_CAP,
  RADAR_RANKING_LIMIT,
  type RadarRanking,
} from "@/utils/constants";
import { fetchScreener, fetchTrending } from "@/services/yahooFinance";

interface RadarSource {
  tickers: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Resolves which ticker symbols the Radar should fetch quotes for, given the
 * selected sector and ranking.
 *
 * - Trending → Yahoo market-wide trending list (remote)
 * - All Companies + Gainers/Losers → Yahoo market-wide screener (remote, ranked)
 * - Specific sector (any ranking) → that sector's static list (page sorts/slices)
 * - All Companies + Default → all tickers, capped (avoids rendering ~2,000 cards)
 */
export function useRadarSource(sector: string, ranking: RadarRanking): RadarSource {
  const [remote, setRemote] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const isAll = sector === RADAR_ALL_KEY;
  const needsTrending = ranking === "trending";
  const needsScreener = isAll && (ranking === "gainers" || ranking === "losers");
  // Stable key so the effect only refires when the remote request changes
  const remoteKey = needsTrending
    ? "trending"
    : needsScreener
      ? `screener:${ranking}`
      : "";

  const load = useCallback(async () => {
    if (!remoteKey) {
      setRemote([]);
      setError(null);
      setLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const symbols = needsTrending
        ? await fetchTrending(RADAR_RANKING_LIMIT)
        : await fetchScreener(
            ranking === "losers" ? "day_losers" : "day_gainers",
            RADAR_RANKING_LIMIT
          );
      if (reqRef.current === id) setRemote(symbols);
    } catch (err) {
      if (reqRef.current === id) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setRemote([]);
      }
    } finally {
      if (reqRef.current === id) setLoading(false);
    }
  }, [remoteKey, needsTrending, ranking]);

  useEffect(() => {
    load();
  }, [load]);

  const staticTickers = useMemo(() => {
    if (isAll) {
      return RADAR_SECTORS[RADAR_ALL_KEY].tickers.slice(0, RADAR_ALL_DEFAULT_CAP);
    }
    return RADAR_SECTORS[sector]?.tickers ?? [];
  }, [isAll, sector]);

  if (remoteKey) {
    return { tickers: remote, loading, error };
  }
  return { tickers: staticTickers, loading: false, error: null };
}
