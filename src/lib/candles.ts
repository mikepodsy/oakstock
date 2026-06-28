import { questradeGet, resolveSymbolId } from "@/lib/questrade";
import { questradeCandlesCache } from "@/lib/cache";
import type { QuestradeCandle } from "@/types";

// Questrade HistoricalDataGranularity → lookback window (days) of history to
// fetch for that candle size. Finer candles get a shorter window (Questrade
// caps how many candles a single request returns); coarser ones go back years.
export const INTERVAL_WINDOWS: Record<string, number> = {
  OneMinute: 2,
  FiveMinutes: 10,
  FifteenMinutes: 30,
  OneHour: 90,
  FourHours: 365,
  OneDay: 1827, // ~5y
  OneWeek: 3653, // ~10y
  OneMonth: 7305, // ~20y
};

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

/**
 * Fetch OHLCV candles for a ticker at a given Questrade interval. Shared by the
 * chart's candles route and the momentum Alerts route so both hit one cache
 * (`TICKER:INTERVAL`, 5-min TTL). Returns candles shaped as `{ time, o,h,l,c, volume }`.
 *
 * Returns null when the ticker can't be resolved to a Questrade symbol (so a
 * single bad ticker in a batch doesn't blow up the whole request). Throws on
 * invalid interval or an upstream Questrade failure.
 */
export async function fetchCandles(
  ticker: string,
  interval: string
): Promise<QuestradeCandle[] | null> {
  const windowDays = INTERVAL_WINDOWS[interval];
  if (windowDays === undefined) {
    throw new Error(`invalid interval '${interval}'`);
  }

  const cacheKey = `${ticker.toUpperCase()}:${interval}`;
  const cached = questradeCandlesCache.get(cacheKey);
  if (cached) return cached as QuestradeCandle[];

  const symbolId = await resolveSymbolId(ticker);
  if (symbolId === null) return null;

  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 86_400_000);

  const data = await questradeGet<CandlesResponse>(
    `/v1/markets/candles/${symbolId}` +
      `?startTime=${encodeURIComponent(start.toISOString())}` +
      `&endTime=${encodeURIComponent(end.toISOString())}` +
      `&interval=${interval}`
  );

  // Shape for charting / indicators: time + OHLCV.
  const candles: QuestradeCandle[] = data.candles.map((c) => ({
    time: c.start,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  questradeCandlesCache.set(cacheKey, candles);
  return candles;
}

/** Convenience wrapper for daily candles (~5y), used by the momentum Alerts route. */
export function fetchDailyCandles(
  ticker: string
): Promise<QuestradeCandle[] | null> {
  return fetchCandles(ticker, "OneDay");
}
