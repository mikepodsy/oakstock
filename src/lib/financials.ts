import type { FinancialData } from "@/types";

/**
 * The slice of Yahoo's quoteSummary response the financials card needs.
 *
 * Deliberately structural rather than importing yahoo-finance2's own types:
 * the library types every module field as optional, so a typo like reading
 * `trailingPE` off `defaultKeyStatistics` compiles clean and silently yields
 * undefined. Naming the fields we expect, per module, keeps that honest.
 */
export interface RawFinancialsInput {
  defaultKeyStatistics?: {
    forwardPE?: number | null;
    trailingEps?: number | null;
  } | null;
  summaryDetail?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    fiftyTwoWeekHigh?: number | null;
    fiftyTwoWeekLow?: number | null;
    dividendYield?: number | null;
    volume?: number | null;
  } | null;
  financialData?: {
    totalRevenue?: number | null;
    profitMargins?: number | null;
    debtToEquity?: number | null;
    revenueGrowth?: number | null;
    earningsGrowth?: number | null;
    recommendationKey?: string | null;
    targetMeanPrice?: number | null;
  } | null;
  assetProfile?: {
    longBusinessSummary?: string | null;
    website?: string | null;
  } | null;
}

const RATING_MAP: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  strong_sell: "Strong Sell",
};

function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatRating(key: string | undefined | null): string | null {
  if (!key) return null;
  return RATING_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `?? null` on its own turns a legitimate 0 into null only for undefined — this keeps that explicit. */
function num(value: number | null | undefined): number | null {
  return value ?? null;
}

export function buildFinancialData(
  ticker: string,
  raw: RawFinancialsInput
): FinancialData {
  const stats = raw.defaultKeyStatistics;
  const detail = raw.summaryDetail;
  const fin = raw.financialData;
  const profile = raw.assetProfile;

  return {
    ticker,
    // summaryDetail is the only module that carries the trailing multiple and
    // the 52-week range — defaultKeyStatistics returns neither.
    peRatio: num(detail?.trailingPE),
    forwardPE: num(detail?.forwardPE ?? stats?.forwardPE),
    eps: num(stats?.trailingEps),
    revenue: num(fin?.totalRevenue),
    // Yahoo's "Quarterly Revenue Growth (yoy)": a decimal, 0.164 = +16.4%.
    revenueGrowth: num(fin?.revenueGrowth),
    earningsGrowth: num(fin?.earningsGrowth),
    profitMargin: num(fin?.profitMargins),
    debtToEquity: num(fin?.debtToEquity),
    dividendYield: num(detail?.dividendYield),
    volume: num(detail?.volume),
    fiftyTwoWeekHigh: num(detail?.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(detail?.fiftyTwoWeekLow),
    description: profile?.longBusinessSummary ?? null,
    analystRating: formatRating(fin?.recommendationKey),
    targetPrice: num(fin?.targetMeanPrice),
    website: extractDomain(profile?.website),
  };
}
