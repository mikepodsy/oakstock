import { NextRequest, NextResponse } from "next/server";
import { volatilityCache } from "@/lib/cache";
import { fetchDoltVolHistory, fetchDoltIvYearRange } from "@/lib/dolthub";
import {
  readIvHistory,
  latestStoredDate,
  upsertIvHistory,
  upsertSnapshot,
} from "@/lib/options/ivHistoryStore";
import { assembleVolStats } from "@/lib/options/volStats";
import { fetchTermStructureAndSkew } from "@/lib/options/questradeVol";
import type { VolHistoryPoint, VolatilityResponse } from "@/types/volatility";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800",
};

// Cap the series returned to the client (≈3y of trading days) to keep the
// payload light; stats use the full stored series server-side anyway.
const MAX_RETURNED_POINTS = 800;

// Load the IV/HV history for a ticker: prefer Supabase, top up from DoltHub for
// any newer dates (and backfill entirely on first view). Best-effort on writes.
async function loadHistory(
  ticker: string,
): Promise<{ history: VolHistoryPoint[]; source: VolatilityResponse["source"] }> {
  const stored = await readIvHistory(ticker);
  const since = stored.length ? await latestStoredDate(ticker) : null;

  let fresh: VolHistoryPoint[] = [];
  try {
    fresh = await fetchDoltVolHistory(ticker, since ?? undefined);
  } catch {
    fresh = [];
  }

  if (fresh.length) {
    await upsertIvHistory(ticker, fresh);
  }

  // Merge stored + fresh (fresh is strictly newer than `since`).
  const merged = [...stored, ...fresh];
  if (merged.length === 0) return { history: [], source: "none" };
  return {
    history: merged,
    source: stored.length && !fresh.length ? "cache" : "dolthub",
  };
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "ticker parameter is required" }, { status: 400 });
  }
  const key = ticker.toUpperCase();

  const cached = volatilityCache.get(key);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    // History (DoltHub/Supabase) and live term-structure/skew (Questrade) in
    // parallel — independent sources.
    const [{ history, source }, qv] = await Promise.all([
      loadHistory(key),
      fetchTermStructureAndSkew(key).catch(() => ({
        spot: null,
        termStructure: [],
        skew: null,
      })),
    ]);

    const yearRange = history.length
      ? await fetchDoltIvYearRange(key).catch(() => ({ high: null, low: null }))
      : { high: null, low: null };

    const stats = assembleVolStats(history, yearRange);

    // Persist today's snapshot onto the latest stored row (best-effort).
    if (history.length) {
      const latest = history[history.length - 1];
      await upsertSnapshot(key, latest.date, {
        ivRank: stats.ivRank,
        ivPercentile: stats.ivPercentile,
        termStructure: qv.termStructure,
        skew: qv.skew,
      });
    }

    const payload: VolatilityResponse = {
      ticker: key,
      spot: qv.spot,
      asOf: new Date().toISOString(),
      history: history.slice(-MAX_RETURNED_POINTS),
      stats,
      termStructure: qv.termStructure,
      skew: qv.skew,
      source,
    };

    volatilityCache.set(key, payload);
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to build volatility data for ${ticker}`, detail: message },
      { status: 500 },
    );
  }
}
