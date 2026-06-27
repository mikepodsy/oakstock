import type {
  QuestradeCandle,
  ExpiryWindow,
  OptionsChainResponse,
} from "@/types";

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

// Fetches the options strike breakdown (open interest + volume per strike, split
// call/put) aggregated over the given expiry window.
export async function fetchOptionStrikes(
  ticker: string,
  window: ExpiryWindow = "2w"
): Promise<OptionsChainResponse> {
  const res = await fetch(
    `/api/questrade/options?ticker=${encodeURIComponent(ticker)}&window=${window}`
  );
  if (!res.ok) throw new Error(`Failed to fetch options for ${ticker}`);
  return res.json();
}
