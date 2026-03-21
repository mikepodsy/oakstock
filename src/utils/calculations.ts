import type { Holding, Lot, HoldingWithQuote, QuoteData } from "@/types";

export function totalShares(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.shares, 0);
}

export function totalCost(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.shares * lot.costPerShare, 0);
}

export function avgCostBasis(lots: Lot[]): number {
  const shares = totalShares(lots);
  if (shares === 0) return 0;
  return totalCost(lots) / shares;
}

export function mergeHoldingWithQuote(
  holding: Holding,
  quote: QuoteData | undefined
): HoldingWithQuote {
  const shares = totalShares(holding.lots);
  const cost = totalCost(holding.lots);
  const price = quote?.currentPrice ?? 0;
  const marketVal = shares * price;
  const gl = marketVal - cost;

  return {
    ...holding,
    currentPrice: price,
    previousClose: quote?.previousClose ?? 0,
    dayChange: quote?.dayChange ?? 0,
    dayChangePercent: quote?.dayChangePercent ?? 0,
    totalShares: shares,
    avgCostBasis: avgCostBasis(holding.lots),
    marketValue: marketVal,
    totalCost: cost,
    gainLoss: gl,
    gainLossPercent: cost > 0 ? (gl / cost) * 100 : 0,
    peRatio: quote?.peRatio,
    fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: quote?.fiftyTwoWeekLow,
    sector: quote?.sector,
    website: quote?.website,
  };
}

export function portfolioTotals(holdings: HoldingWithQuote[]) {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPercent =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const totalDayChange = holdings.reduce(
    (sum, h) => sum + h.totalShares * h.dayChange,
    0
  );
  const prevValue = totalValue - totalDayChange;
  const totalDayChangePercent =
    prevValue > 0 ? (totalDayChange / prevValue) * 100 : 0;

  return {
    totalValue,
    totalCost: totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    totalDayChange,
    totalDayChangePercent,
  };
}
