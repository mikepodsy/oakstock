import type { QuestradeCandle, OptionsChainResponse } from "@/types";

// Fetches OHLCV candles from Questrade at the given candle granularity
// (Questrade HistoricalDataGranularity, e.g. "OneMinute", "OneDay"). The route
// picks how far back to fetch based on the interval.
export async function fetchQuestradeCandles(
  ticker: string,
  interval: string = "OneDay"
): Promise<QuestradeCandle[]> {
  const res = await fetch(
    `/api/questrade/candles?ticker=${encodeURIComponent(ticker)}&interval=${interval}`
  );
  if (!res.ok) throw new Error(`Failed to fetch Questrade candles for ${ticker}`);
  return res.json();
}

// Fetches the options strike breakdown (open interest + volume + per-side GEX per
// strike) aggregated over the given expiry dates (YYYY-MM-DD). When no expiries
// are supplied the API falls back to the front expiry.
export async function fetchOptionStrikes(
  ticker: string,
  expiries: string[] = []
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ ticker });
  if (expiries.length > 0) params.set("expiries", expiries.join(","));
  const res = await fetch(`/api/questrade/options?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch options for ${ticker}`);
  return res.json();
}
