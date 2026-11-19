import type { FinancialStatement, FundamentalsData } from "@/types";
import { METRIC_IDS, type MetricId } from "./registry";

/**
 * The slice of Yahoo's quoteSummary the comps engine reads. Structural on
 * purpose (see lib/financials.ts): naming the fields per module keeps a typo
 * from compiling into a silent undefined.
 */
export interface CompSummaryInput {
  price?: {
    regularMarketPrice?: number | null;
    marketCap?: number | null;
    longName?: string | null;
    shortName?: string | null;
    currency?: string | null;
  } | null;
  assetProfile?: { sector?: string | null; industry?: string | null } | null;
  defaultKeyStatistics?: {
    enterpriseValue?: number | null;
    pegRatio?: number | null;
    priceToBook?: number | null;
    trailingEps?: number | null;
  } | null;
  financialData?: {
    totalRevenue?: number | null;
    ebitda?: number | null;
    operatingCashflow?: number | null;
    grossMargins?: number | null;
    operatingMargins?: number | null;
    profitMargins?: number | null;
    returnOnEquity?: number | null;
    returnOnAssets?: number | null;
    debtToEquity?: number | null; // Yahoo reports this as a percent (28.5 = 0.285)
    currentRatio?: number | null;
    totalDebt?: number | null;
    totalCash?: number | null;
    /** Currency the statements are reported in (EUR for ASML) — can differ from the trading currency. */
    financialCurrency?: string | null;
    revenueGrowth?: number | null;
    earningsGrowth?: number | null;
  } | null;
  earningsTrend?: {
    trend?: Array<{
      period?: string | null; // "0q" | "+1q" | "0y" | "+1y" | …
      endDate?: Date | string | null;
      earningsEstimate?: { avg?: number | null } | null;
    }> | null;
  } | null;
  summaryDetail?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    priceToSalesTrailing12Months?: number | null;
    dividendYield?: number | null;
  } | null;
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface CompRow {
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  /** Trading currency of `price`. Market cap and EV are always reported in USD. */
  currency: string | null;
  price: number | null;
  values: Record<MetricId, number | null>;
  error?: string;
}

const TAX_RATE = 0.21;

type StatementField = Exclude<keyof FinancialStatement, "date">;

function finite(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

/** a ÷ b, or null when either side is missing or the denominator isn't positive (→ "NM"). */
export function multiple(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b <= 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** a ÷ b allowing a negative numerator (margins, yields) but not a non-positive denominator. */
function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b <= 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** (cur − prev) ÷ |prev|; null when the base isn't positive (growth off a loss isn't meaningful). */
export function growth(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev <= 0) return null;
  return (cur - prev) / prev;
}

export function cagr(end: number | null, start: number | null, years: number): number | null {
  if (end == null || start == null || start <= 0 || end <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

const DAY_MS = 86_400_000;

/**
 * Sum of a field over four consecutive quarters ending `offset` quarters back
 * from the latest. Null unless all four are present and they span roughly a
 * year (guards against gaps in the quarterly history).
 */
export function ttm(
  quarterly: FinancialStatement[],
  field: StatementField,
  offset = 0
): number | null {
  const end = quarterly.length - offset;
  if (end < 4) return null;
  const window = quarterly.slice(end - 4, end);
  const span = (Date.parse(window[3].date) - Date.parse(window[0].date)) / DAY_MS;
  if (span < 240 || span > 310) return null;
  let sum = 0;
  for (const q of window) {
    const v = q[field];
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/** TTM from quarters, falling back to the latest (or offset) fiscal year. */
function trailing(f: FundamentalsData | null, field: StatementField, offset = 0): number | null {
  if (!f) return null;
  const fromQuarters = ttm(f.quarterly, field, offset * 4);
  if (fromQuarters != null) return fromQuarters;
  const annual = f.annual.at(-1 - offset);
  return annual?.[field] ?? null;
}

/** Latest point-in-time balance-sheet value (quarterly first, then annual). */
function latestBalance(f: FundamentalsData | null, field: StatementField): number | null {
  if (!f) return null;
  for (const list of [f.quarterly, f.annual]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i][field];
      if (v != null) return v;
    }
  }
  return null;
}

function annualCagr(f: FundamentalsData | null, field: StatementField, years = 3): number | null {
  if (!f || f.annual.length < years + 1) return null;
  const end = f.annual.at(-1)?.[field] ?? null;
  const start = f.annual.at(-1 - years)?.[field] ?? null;
  return cagr(end, start, years);
}

/** Close at or before `target` (prices sorted ascending). */
function closeOnOrBefore(prices: PricePoint[], target: string): number | null {
  let found: number | null = null;
  for (const p of prices) {
    if (p.date > target) break;
    found = p.close;
  }
  return found;
}

function isoDaysAgo(from: string, days: number): string {
  return new Date(Date.parse(`${from}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

export function priceReturns(prices: PricePoint[]): {
  return1m: number | null;
  returnYtd: number | null;
  return1y: number | null;
} {
  const last = prices.at(-1);
  if (!last) return { return1m: null, returnYtd: null, return1y: null };
  const ret = (base: number | null) => (base != null && base > 0 ? last.close / base - 1 : null);
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  return {
    return1m: ret(closeOnOrBefore(prices, isoDaysAgo(last.date, 30))),
    returnYtd: ret(closeOnOrBefore(prices, isoDaysAgo(yearStart, 1))),
    return1y: ret(closeOnOrBefore(prices, isoDaysAgo(last.date, 365))),
  };
}

/**
 * Next-twelve-months consensus EPS: the current and next fiscal-year estimates
 * blended by how much of the current year is left — Bloomberg's "BF" basis.
 * Yahoo's own forwardPE uses the next fiscal year alone, which near a
 * year-end skips almost a full year ahead.
 */
export function ntmEps(trend: NonNullable<CompSummaryInput["earningsTrend"]>["trend"], asOf: Date): number | null {
  if (!trend) return null;
  const cur = trend.find((t) => t.period === "0y");
  const next = trend.find((t) => t.period === "+1y");
  const curEps = cur?.earningsEstimate?.avg;
  const nextEps = next?.earningsEstimate?.avg;
  if (curEps == null || nextEps == null || cur?.endDate == null) return null;
  const end = new Date(cur.endDate).getTime();
  if (!Number.isFinite(end)) return null;
  const w = Math.min(Math.max((end - asOf.getTime()) / (365 * DAY_MS), 0), 1);
  return w * curEps + (1 - w) * nextEps;
}

export function emptyValues(): Record<MetricId, number | null> {
  return Object.fromEntries(METRIC_IDS.map((id) => [id, null])) as Record<MetricId, number | null>;
}

/**
 * FX rates for one row. `reportingToTrading` converts statement figures into
 * the trading currency (EUR→USD for the ASML ADR); `tradingToUsd` converts
 * market cap / EV for display so sizes compare across listings. Both 1 for a
 * US company.
 */
export interface FxRates {
  reportingToTrading: number;
  tradingToUsd: number;
}

export const NO_FX: FxRates = { reportingToTrading: 1, tradingToUsd: 1 };

export function buildCompRow(
  ticker: string,
  summary: CompSummaryInput,
  fundamentals: FundamentalsData | null,
  prices: PricePoint[],
  fx: FxRates = NO_FX,
  asOf: Date = new Date()
): CompRow {
  const pr = summary.price;
  const ks = summary.defaultKeyStatistics;
  const fd = summary.financialData;
  const sd = summary.summaryDetail;

  const tradingCcy = pr?.currency ?? null;
  const reportingCcy = fd?.financialCurrency ?? tradingCcy;
  // Foreign filers / ADRs: statements are in another currency, and one ADR can
  // represent several ordinary shares, so per-share figures (EPS) don't line
  // up with the ADR price and Yahoo's enterpriseValue mixes currencies.
  const crossCurrency = reportingCcy != null && tradingCcy != null && reportingCcy !== tradingCcy;
  const k = fx.reportingToTrading;
  const conv = (v: number | null) => (v == null ? null : v * k);

  const price = finite(pr?.regularMarketPrice) ?? prices.at(-1)?.close ?? null;
  const marketCap = finite(pr?.marketCap);

  // Every monetary aggregate below is in the trading currency.
  const revenue = conv(trailing(fundamentals, "revenue") ?? finite(fd?.totalRevenue));
  const ebitda = conv(trailing(fundamentals, "ebitda") ?? finite(fd?.ebitda));
  const ebit = conv(trailing(fundamentals, "operatingIncome"));
  const netIncome = conv(trailing(fundamentals, "netIncome"));
  const grossProfit = conv(trailing(fundamentals, "grossProfit"));
  // Yahoo's financialData.freeCashflow is a "levered FCF" estimate that can be
  // off by orders of magnitude (MSFT: $3B vs ~$70B reported) — only ever use
  // reported cash flows.
  const fcf = conv(trailing(fundamentals, "freeCashFlow"));
  const eps = trailing(fundamentals, "eps") ?? finite(ks?.trailingEps);

  const totalDebt = conv(finite(fd?.totalDebt) ?? latestBalance(fundamentals, "totalDebt"));
  const cash = conv(finite(fd?.totalCash));
  const equity = conv(latestBalance(fundamentals, "stockholdersEquity"));

  const computedEv = marketCap != null ? marketCap + (totalDebt ?? 0) - (cash ?? 0) : null;
  const enterpriseValue = crossCurrency ? computedEv : finite(ks?.enterpriseValue) ?? computedEv;
  const netDebt = totalDebt != null ? totalDebt - (cash ?? 0) : null;

  // Price ÷ EPS only from four reported quarters: EDGAR has no Q4 EPS, and
  // falling back to the last fiscal year's EPS would be stale. Market cap ÷
  // net income gives the same answer without per-share pitfalls.
  const quarterlyEps = fundamentals ? ttm(fundamentals.quarterly, "eps") : null;
  // A known non-positive EPS is NM — never fall through to another source.
  const pe = crossCurrency
    ? multiple(marketCap, netIncome)
    : quarterlyEps != null
      ? multiple(price, quarterlyEps)
      : netIncome != null
        ? multiple(marketCap, netIncome)
        : multiple(price, eps) ?? multiple(finite(sd?.trailingPE), 1);
  const epsGrowth =
    growth(eps, trailing(fundamentals, "eps", 1)) ?? finite(fd?.earningsGrowth);
  const computedPeg = pe != null && epsGrowth != null && epsGrowth > 0 ? pe / (epsGrowth * 100) : null;
  const yahooPeg = finite(ks?.pegRatio);

  const investedCapital =
    totalDebt != null && equity != null ? totalDebt + equity - (cash ?? 0) : null;

  const values = emptyValues();
  Object.assign(values, {
    pe,
    // ADR estimates can be per ordinary share or in another currency, so
    // only blend NTM for same-currency listings.
    forwardPe: crossCurrency
      ? multiple(finite(sd?.forwardPE), 1)
      : multiple(price, ntmEps(summary.earningsTrend?.trend, asOf)) ?? multiple(finite(sd?.forwardPE), 1),
    peg: yahooPeg != null && yahooPeg > 0 ? yahooPeg : computedPeg,
    ps: multiple(marketCap, revenue) ?? multiple(finite(sd?.priceToSalesTrailing12Months), 1),
    pb: multiple(finite(ks?.priceToBook), 1),
    evSales: multiple(enterpriseValue, revenue),
    evEbitda: multiple(enterpriseValue, ebitda),
    evEbit: multiple(enterpriseValue, ebit),
    evFcf: multiple(enterpriseValue, fcf),
    pFcf: multiple(marketCap, fcf),
    fcfYield: ratio(fcf, marketCap),
    dividendYield: finite(sd?.dividendYield) ?? (marketCap != null ? 0 : null),

    // Growth compares like with like in the reporting currency (no FX applied).
    revenueGrowth:
      growth(trailing(fundamentals, "revenue"), trailing(fundamentals, "revenue", 1)) ??
      finite(fd?.revenueGrowth),
    epsGrowth,
    ebitdaGrowth: growth(trailing(fundamentals, "ebitda"), trailing(fundamentals, "ebitda", 1)),
    revenueCagr3y: annualCagr(fundamentals, "revenue"),
    epsCagr3y: annualCagr(fundamentals, "eps"),

    grossMargin: ratio(grossProfit, revenue) ?? finite(fd?.grossMargins),
    operatingMargin: ratio(ebit, revenue) ?? finite(fd?.operatingMargins),
    netMargin: ratio(netIncome, revenue) ?? finite(fd?.profitMargins),
    fcfMargin: ratio(fcf, revenue),
    roe: ratio(netIncome, equity) ?? finite(fd?.returnOnEquity),
    roa: finite(fd?.returnOnAssets),
    roic: ebit != null ? ratio(ebit * (1 - TAX_RATE), investedCapital) : null,

    marketCap: marketCap != null ? marketCap * fx.tradingToUsd : null,
    enterpriseValue: enterpriseValue != null ? enterpriseValue * fx.tradingToUsd : null,
    netDebtEbitda: netDebt != null ? ratio(netDebt, ebitda) : null,
    debtEquity:
      fd?.debtToEquity != null && Number.isFinite(fd.debtToEquity)
        ? fd.debtToEquity / 100
        : ratio(totalDebt, equity),
    currentRatio: finite(fd?.currentRatio),
    ...priceReturns(prices),
  } satisfies Partial<Record<MetricId, number | null>>);

  return {
    ticker,
    name: pr?.longName ?? pr?.shortName ?? ticker,
    sector: summary.assetProfile?.sector ?? null,
    industry: summary.assetProfile?.industry ?? null,
    currency: tradingCcy,
    price,
    values,
  };
}

export function errorRow(ticker: string, error: string): CompRow {
  return {
    ticker,
    name: ticker,
    sector: null,
    industry: null,
    currency: null,
    price: null,
    values: emptyValues(),
    error,
  };
}
