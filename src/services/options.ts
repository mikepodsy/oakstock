import type { OptionChainData } from "@/types/options";
import type { VolatilityResponse } from "@/types/volatility";

// Fetches a single expiry's option chain (per-contract bid/ask/mid/IV/greeks)
// for the position builder. Omitting `expiry` returns the nearest future expiry.
export async function fetchOptionChain(
  ticker: string,
  expiry?: string,
): Promise<OptionChainData> {
  const params = new URLSearchParams({ ticker });
  if (expiry) params.set("expiry", expiry);
  const res = await fetch(`/api/options/chain?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch option chain for ${ticker}`);
  }
  return res.json();
}

// Fetches the assembled volatility dashboard (IV/HV history + stats + term
// structure + front-expiry skew).
export async function fetchVolatility(ticker: string): Promise<VolatilityResponse> {
  const res = await fetch(`/api/options/volatility?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch volatility for ${ticker}`);
  }
  return res.json();
}
