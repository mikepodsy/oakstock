import type { EconomicIndicator, EconomicIndicatorData, EconomicTimeRange } from "@/types";

export async function fetchEconomicData(
  indicator: EconomicIndicator,
  range: EconomicTimeRange
): Promise<EconomicIndicatorData> {
  const params = new URLSearchParams({ range });
  const res = await fetch(`/api/economic/${indicator}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${indicator} data`);
  return res.json();
}
