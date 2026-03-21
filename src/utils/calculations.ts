import type { Holding, Lot, HoldingWithQuote, QuoteData, PortfolioChartPoint } from "@/types";

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

// ─── Portfolio Metrics ──────────────────────────────

export interface PortfolioMetrics {
  beta: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
}

function dailyReturns(values: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (a[i] - ma) * (b[i] - mb);
  }
  return sum / (n - 1);
}

const ANNUAL_RISK_FREE_RATE = 0.045; // ~4.5% (approx 3-month T-bill)
const TRADING_DAYS_PER_YEAR = 252;

export function calculatePortfolioMetrics(
  chartData: PortfolioChartPoint[]
): PortfolioMetrics {
  if (chartData.length < 10) {
    return { beta: null, sharpeRatio: null, sortinoRatio: null };
  }

  const portfolioValues = chartData.map((p) => p.portfolioValue);
  const pReturns = dailyReturns(portfolioValues);

  if (pReturns.length < 5) {
    return { beta: null, sharpeRatio: null, sortinoRatio: null };
  }

  const dailyRf = ANNUAL_RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;

  // Beta: Cov(portfolio, benchmark) / Var(benchmark)
  let beta: number | null = null;
  const benchmarkValues = chartData
    .map((p) => p.benchmarkValue)
    .filter((v): v is number => v !== null);

  if (benchmarkValues.length >= 10) {
    const bReturns = dailyReturns(benchmarkValues);
    const minLen = Math.min(pReturns.length, bReturns.length);
    if (minLen >= 5) {
      const pSlice = pReturns.slice(pReturns.length - minLen);
      const bSlice = bReturns.slice(bReturns.length - minLen);
      const bVar = stdDev(bSlice) ** 2;
      if (bVar > 0) {
        beta = covariance(pSlice, bSlice) / bVar;
      }
    }
  }

  // Sharpe: (annualized return - risk free) / annualized volatility
  const meanReturn = mean(pReturns);
  const vol = stdDev(pReturns);
  let sharpeRatio: number | null = null;
  if (vol > 0) {
    const excessReturn = meanReturn - dailyRf;
    sharpeRatio = (excessReturn / vol) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  // Sortino: same as Sharpe but uses downside deviation
  const downsideReturns = pReturns.filter((r) => r < dailyRf);
  let sortinoRatio: number | null = null;
  if (downsideReturns.length > 1) {
    const downsideVar =
      downsideReturns.reduce((s, r) => s + (r - dailyRf) ** 2, 0) /
      (downsideReturns.length - 1);
    const downsideDev = Math.sqrt(downsideVar);
    if (downsideDev > 0) {
      const excessReturn = meanReturn - dailyRf;
      sortinoRatio = (excessReturn / downsideDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }
  }

  return { beta, sharpeRatio, sortinoRatio };
}
