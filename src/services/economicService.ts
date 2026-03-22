import type {
  EconomicIndicator,
  MarketIndicator,
  EconomicIndicatorData,
  EconomicTimeRange,
  TreasuryBundleData,
} from "@/types";

export async function fetchEconomicData(
  indicator: EconomicIndicator,
  range: EconomicTimeRange
): Promise<EconomicIndicatorData> {
  const params = new URLSearchParams({ range });
  const res = await fetch(`/api/economic/${indicator}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${indicator} data`);
  return res.json();
}

export async function fetchMarketData(
  symbol: MarketIndicator,
  range: EconomicTimeRange
): Promise<EconomicIndicatorData> {
  const params = new URLSearchParams({ range });
  const res = await fetch(`/api/market/${symbol}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${symbol} data`);
  return res.json();
}

export async function fetchTreasuryData(
  range: EconomicTimeRange
): Promise<TreasuryBundleData> {
  const params = new URLSearchParams({ range });
  const res = await fetch(`/api/economic/treasury?${params}`);
  if (!res.ok) throw new Error("Failed to fetch treasury data");
  return res.json();
}
