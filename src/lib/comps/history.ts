import type { FinancialStatement } from "@/types";
import type { PricePoint } from "./metrics";
import { median } from "./stats";

// Quarterly results aren't public on the period-end date. Only count a quarter
// once this many days have passed, so the historical P/E never "knows" earnings
// before they were reported.
export const REPORTING_LAG_DAYS = 45;

const DAY_MS = 86_400_000;

type FlowField = "netIncome" | "revenue" | "ebitda" | "operatingIncome" | "freeCashFlow";

/**
 * TTM of a dollar field as known on `asOf`: the four latest quarters reported
 * by then (period end + lag). Null without four consecutive quarters spanning
 * about a year.
 *
 * Deliberately not EPS: EDGAR's quarterly EPS has no Q4 (10-Ks only state the
 * year) and mixes pre- and post-split values, while chart prices are
 * split-adjusted. Dollar figures have neither problem.
 */
export function ttmAsOf(quarterly: FinancialStatement[], field: FlowField, asOf: string): number | null {
  const cutoff = Date.parse(`${asOf}T00:00:00Z`) - REPORTING_LAG_DAYS * DAY_MS;
  const known = quarterly.filter((q) => Date.parse(q.date) <= cutoff);
  if (known.length < 4) return null;
  const window = known.slice(-4);
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

export interface SharePoint {
  date: string; // YYYY-MM-DD fiscal period end
  shares: number; // split-adjusted diluted average shares
}

/** Latest share count on or before `asOf`, else the earliest known (history is short). */
export function sharesAsOf(history: SharePoint[], asOf: string): number | null {
  if (history.length === 0) return null;
  let found: number | null = null;
  for (const h of history) {
    if (h.date > asOf) break;
    found = h.shares;
  }
  return found ?? history[0].shares;
}

/** Last close of each calendar month (prices sorted ascending). */
export function monthEnds(prices: PricePoint[]): PricePoint[] {
  const out: PricePoint[] = [];
  for (const p of prices) {
    const last = out.at(-1);
    if (last && last.date.slice(0, 7) === p.date.slice(0, 7)) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

export interface PeSeriesPoint {
  date: string; // YYYY-MM
  pe: number | null;
}

export interface PeSeriesOptions {
  /** Reporting → trading currency (EUR→USD for an ADR). Applied at today's rate. */
  fx?: number;
  /**
   * Multiplier on `shares` so the latest count matches market cap ÷ price —
   * converts ordinary shares into ADR-equivalents and absorbs any gap between
   * diluted-average and outstanding shares.
   */
  shareScale?: number;
}

/** Monthly trailing P/E = market cap ÷ TTM net income. Losses give null (NM). */
export function peSeries(
  prices: PricePoint[],
  quarterly: FinancialStatement[],
  shares: SharePoint[],
  { fx = 1, shareScale = 1 }: PeSeriesOptions = {}
): PeSeriesPoint[] {
  return monthEnds(prices).map((p) => {
    const ni = ttmAsOf(quarterly, "netIncome", p.date);
    const sh = sharesAsOf(shares, p.date);
    const pe =
      ni != null && ni > 0 && sh != null ? (p.close * sh * shareScale) / (ni * fx) : null;
    return { date: p.date.slice(0, 7), pe };
  });
}

export interface HistoryPoint {
  date: string; // YYYY-MM
  target: number | null;
  peerMedian: number | null;
  peerCount: number;
}

/** Align the target's series with each peer's by month and take the peer median. */
export function combineHistory(target: PeSeriesPoint[], peers: PeSeriesPoint[][]): HistoryPoint[] {
  const peerMaps = peers.map((s) => new Map(s.map((p) => [p.date, p.pe])));
  return target.map((t) => {
    const vals = peerMaps.map((m) => m.get(t.date) ?? null).filter((v): v is number => v != null);
    return { date: t.date, target: t.pe, peerMedian: median(vals), peerCount: vals.length };
  });
}
