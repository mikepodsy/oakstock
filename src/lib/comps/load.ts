import YahooFinance from "yahoo-finance2";
import { withTimeout } from "@/lib/apiHandler";
import { compRowCache, quoteCache } from "@/lib/cache";
import { getFundamentals } from "@/lib/fundamentals";
import type { SharePoint } from "./history";
import {
  buildCompRow,
  errorRow,
  type CompRow,
  type CompSummaryInput,
  type FxRates,
  type PricePoint,
} from "./metrics";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SUMMARY_MODULES = [
  "price",
  "assetProfile",
  "defaultKeyStatistics",
  "financialData",
  "summaryDetail",
  "earningsTrend",
] as const;

export async function fetchSummary(ticker: string): Promise<CompSummaryInput> {
  return (await withTimeout(
    yf.quoteSummary(ticker, { modules: [...SUMMARY_MODULES] }),
    15_000,
    `quoteSummary(${ticker})`
  )) as unknown as CompSummaryInput;
}

/** Daily (or other interval) closes from `days` ago to today, ascending. */
export async function fetchCloses(
  ticker: string,
  days: number,
  interval: "1d" | "1wk" | "1mo" = "1d"
): Promise<PricePoint[]> {
  const res = await withTimeout(
    yf.chart(ticker, { period1: new Date(Date.now() - days * 86_400_000), interval }),
    15_000,
    `chart(${ticker})`
  );
  return res.quotes
    .filter((q) => q.close != null)
    .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close as number }));
}

/** Units of `to` per one `from` (e.g. EUR→USD ≈ 1.08). Throws if Yahoo has no pair. */
export async function fxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const key = `fx:${from}${to}`;
  const cached = quoteCache.get(key) as { rate: number } | undefined;
  if (cached) return cached.rate;
  const q = await withTimeout(yf.quote(`${from}${to}=X`), 10_000, `fx ${from}${to}`);
  const rate = (q as { regularMarketPrice?: number }).regularMarketPrice;
  if (rate == null || !(rate > 0)) throw new Error(`No FX rate for ${from}${to}`);
  quoteCache.set(key, { rate });
  return rate;
}

async function ratesFor(summary: CompSummaryInput): Promise<FxRates> {
  const trading = summary.price?.currency ?? "USD";
  const reporting = summary.financialData?.financialCurrency ?? trading;
  const [reportingToTrading, tradingToUsd] = await Promise.all([
    fxRate(reporting, trading),
    fxRate(trading, "USD"),
  ]);
  return { reportingToTrading, tradingToUsd };
}

/** One comps row. Never throws: failures come back as an error row. */
export async function loadCompRow(ticker: string): Promise<CompRow> {
  const cached = compRowCache.get(ticker) as CompRow | undefined;
  if (cached) return cached;
  try {
    // 400 days covers both the 1-year return and the prior year-end close for YTD.
    const [summary, fundamentals, prices] = await Promise.all([
      fetchSummary(ticker),
      getFundamentals(ticker).catch(() => null),
      fetchCloses(ticker, 400).catch(() => [] as PricePoint[]),
    ]);
    const fx = await ratesFor(summary);
    const row = buildCompRow(ticker, summary, fundamentals, prices, fx);
    compRowCache.set(ticker, row);
    return row;
  } catch (err) {
    console.warn(`[comps] row failed for ${ticker}:`, err instanceof Error ? err.message : err);
    return errorRow(ticker, "Data unavailable");
  }
}

/** Run `fn` over items with at most `limit` in flight, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Parse a comma-separated ticker list from a query param: upper-cased, de-duplicated, capped. */
export function parseTickers(raw: string | null, max: number): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const t of raw.split(",")) {
    const v = t.trim().toUpperCase();
    if (v && /^[A-Z0-9][A-Z0-9.\-^=]{0,14}$/.test(v)) seen.add(v);
  }
  return [...seen].slice(0, max);
}

/** Yahoo's split-adjusted annual diluted share counts (~4 fiscal years), ascending. */
export async function fetchShareHistory(ticker: string): Promise<SharePoint[]> {
  const rows = (await withTimeout(
    yf.fundamentalsTimeSeries(ticker, {
      period1: "2015-01-01",
      period2: new Date().toISOString().slice(0, 10),
      type: "annual",
      module: "all",
    }),
    15_000,
    `share history(${ticker})`
  )) as Array<{ date: Date; dilutedAverageShares?: number | null }>;
  return rows
    .filter((r) => r.dilutedAverageShares != null && r.dilutedAverageShares > 0)
    .map((r) => ({ date: r.date.toISOString().slice(0, 10), shares: r.dilutedAverageShares as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** FX + share scaling for a historical P/E series (see PeSeriesOptions). */
export async function historyContext(
  ticker: string,
  shares: SharePoint[]
): Promise<{ fx: number; shareScale: number; shares: SharePoint[] }> {
  const summary = await fetchSummary(ticker);
  const trading = summary.price?.currency ?? "USD";
  const reporting = summary.financialData?.financialCurrency ?? trading;
  const fx = await fxRate(reporting, trading);
  const mc = summary.price?.marketCap;
  const px = summary.price?.regularMarketPrice;
  const implied = mc != null && px != null && px > 0 ? mc / px : null;
  if (shares.length === 0) {
    // No history: hold today's implied count flat.
    return { fx, shareScale: 1, shares: implied ? [{ date: "1900-01-01", shares: implied }] : [] };
  }
  const latest = shares[shares.length - 1].shares;
  return { fx, shareScale: implied ? implied / latest : 1, shares };
}
