import type { QuestradeCandle } from "@/types";

// Fetches OHLCV candles from Questrade. The interval is chosen server-side by
// the route's PERIODS map, so only the period needs to be passed here.
export async function fetchQuestradeCandles(
  ticker: string,
  period: string = "3m"
): Promise<QuestradeCandle[]> {
  const res = await fetch(
    `/api/questrade/candles?ticker=${encodeURIComponent(ticker)}&period=${period}`
  );
  if (!res.ok) throw new Error(`Failed to fetch Questrade candles for ${ticker}`);
  return res.json();
}
