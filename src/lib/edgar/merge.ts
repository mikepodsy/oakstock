import type { FinancialStatement, FundamentalsData } from "@/types";

// Every numeric field on a statement (everything but the `date` key). These are
// the cells a fallback source is allowed to fill.
const NUMERIC_FIELDS = [
  "revenue",
  "ebitda",
  "freeCashFlow",
  "operatingCashFlow",
  "capex",
  "netIncome",
  "grossProfit",
  "operatingIncome",
  "costOfRevenue",
  "eps",
  "epsBasic",
  "buybacks",
  "dividendsPaid",
  "totalDebt",
  "stockholdersEquity",
] as const satisfies readonly (keyof FinancialStatement)[];

// Two period-end dates refer to the same fiscal period if they're within this
// many days. EDGAR keys on the exact 10-K/10-Q period end; Yahoo's reported
// fiscal-year-end can drift a few days (4-4-5 calendars, week-ending dates).
const MATCH_TOLERANCE_DAYS = 21;

function fillNulls(
  primary: FinancialStatement,
  fallback: FinancialStatement,
): FinancialStatement {
  const out = { ...primary };
  for (const field of NUMERIC_FIELDS) {
    if (out[field] == null && fallback[field] != null) {
      (out[field] as number | null) = fallback[field];
    }
  }
  return out;
}

// Merge a single period series: for each primary statement, fill its null cells
// from the nearest-dated fallback statement within tolerance. Fallback periods
// that match nothing in primary are appended (a year the primary source lacks
// entirely). Primary period dates and ordering are preserved.
function mergeSeries(
  primary: FinancialStatement[],
  fallback: FinancialStatement[],
): FinancialStatement[] {
  const usedFallback = new Set<number>();

  const merged = primary.map((p) => {
    const target = Date.parse(p.date);
    let bestIdx = -1;
    let bestDiff = Infinity;
    fallback.forEach((f, i) => {
      const diff = Math.abs(Date.parse(f.date) - target);
      if (diff <= MATCH_TOLERANCE_DAYS * 86_400_000 && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    });
    if (bestIdx === -1) return p;
    usedFallback.add(bestIdx);
    return fillNulls(p, fallback[bestIdx]);
  });

  const leftover = fallback.filter((_, i) => !usedFallback.has(i));
  return [...merged, ...leftover].sort((a, b) => a.date.localeCompare(b.date));
}

// Fill gaps in a primary fundamentals dataset (EDGAR) with values from a
// fallback dataset (Yahoo). Only null cells are touched, so the primary source
// always wins where it has data; the fallback purely backfills what's missing.
export function mergeFundamentals(
  primary: FundamentalsData,
  fallback: FundamentalsData,
): FundamentalsData {
  return {
    ticker: primary.ticker,
    annual: mergeSeries(primary.annual, fallback.annual),
    quarterly: mergeSeries(primary.quarterly, fallback.quarterly),
  };
}
