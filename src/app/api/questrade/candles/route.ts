import { NextRequest, NextResponse } from "next/server";
import { questradeGet } from "@/lib/questrade";
import { questradeSymbolCache, questradeCandlesCache } from "@/lib/cache";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

// Questrade HistoricalDataGranularity → lookback window (days) of history to
// fetch for that candle size. Finer candles get a shorter window (Questrade
// caps how many candles a single request returns); coarser ones go back years.
const INTERVAL_WINDOWS: Record<string, number> = {
  OneMinute: 2,
  FiveMinutes: 10,
  FifteenMinutes: 30,
  OneHour: 90,
  FourHours: 365,
  OneDay: 1827, // ~5y
  OneWeek: 3653, // ~10y
  OneMonth: 7305, // ~20y
};

const DEFAULT_INTERVAL = "OneDay";

interface SearchResponse {
  symbols: Array<{ symbolId: number; symbol: string; isTradable: boolean }>;
}

interface CandlesResponse {
  candles: Array<{
    start: string;
    end: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

async function resolveSymbolId(ticker: string): Promise<number | null> {
  const cacheKey = ticker.toUpperCase();
  const cached = questradeSymbolCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const data = await questradeGet<SearchResponse>(
    `/v1/symbols/search?prefix=${encodeURIComponent(ticker)}`
  );

  // Prefer an exact ticker match, else the first result.
  const match =
    data.symbols.find((s) => s.symbol.toUpperCase() === cacheKey) ??
    data.symbols[0];
  const symbolId = match ? match.symbolId : null;

  questradeSymbolCache.set(cacheKey, symbolId);
  return symbolId;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const interval = request.nextUrl.searchParams.get("interval") ?? DEFAULT_INTERVAL;

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  const windowDays = INTERVAL_WINDOWS[interval];
  if (windowDays === undefined) {
    return NextResponse.json(
      { error: `invalid interval '${interval}'` },
      { status: 400 }
    );
  }

  const cacheKey = `${ticker.toUpperCase()}:${interval}`;
  const cached = questradeCandlesCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const symbolId = await resolveSymbolId(ticker);
    if (symbolId === null) {
      return NextResponse.json(
        { error: `No Questrade symbol found for '${ticker}'` },
        { status: 404 }
      );
    }

    const end = new Date();
    const start = new Date(end.getTime() - windowDays * 86_400_000);

    const data = await questradeGet<CandlesResponse>(
      `/v1/markets/candles/${symbolId}` +
        `?startTime=${encodeURIComponent(start.toISOString())}` +
        `&endTime=${encodeURIComponent(end.toISOString())}` +
        `&interval=${interval}`
    );

    // Shape for charting: time + OHLCV.
    const candles = data.candles.map((c) => ({
      time: c.start,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    questradeCandlesCache.set(cacheKey, candles);
    return NextResponse.json(candles, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Questrade candles for ${ticker}`, detail: message },
      { status: 500 }
    );
  }
}
