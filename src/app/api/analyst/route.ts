import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { analystCache } from "@/lib/cache";
import {
  buildAnalystData,
  type RawAnalystInput,
  type RawCashFlowRow,
} from "@/lib/analyst";
import type { AnalystData } from "@/types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800",
};

/** Annual diluted EPS this far back, for the reported bars in the EPS chart. */
const EPS_HISTORY_START = "2015-01-01";

/**
 * Quarterly fundamentals this far back. Short on purpose: the FCF chart shows
 * the last 12 quarters, and asking Yahoo for a decade of them just to throw
 * most away costs a slower response on every uncached symbol.
 */
const QUARTERLY_HISTORY_YEARS = 4;

/** The fields of a `fundamentalsTimeSeries` row this route reads. */
type FundamentalsRow = {
  date?: unknown;
  dilutedEPS?: unknown;
  basicEPS?: unknown;
  freeCashFlow?: unknown;
  operatingCashFlow?: unknown;
  cashFlowFromContinuingOperatingActivities?: unknown;
  capitalExpenditure?: unknown;
};

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Cash-flow rows in the shape `buildCashFlow` wants.
 *
 * Capex comes off the statement negative (it's an outflow); it's flipped to a
 * magnitude here so the tooltip can read "capex $12.4B" without a minus sign
 * fighting the word.
 */
function toCashFlowRows(rows: FundamentalsRow[]): RawCashFlowRow[] {
  return rows.flatMap((row) => {
    const date = row.date instanceof Date ? row.date : new Date(String(row.date));
    if (Number.isNaN(date.getTime())) return [];

    const capex = numOrNull(row.capitalExpenditure);
    return [
      {
        date,
        freeCashFlow: numOrNull(row.freeCashFlow),
        operatingCashFlow:
          numOrNull(row.operatingCashFlow) ??
          numOrNull(row.cashFlowFromContinuingOperatingActivities),
        capex: capex == null ? null : Math.abs(capex),
      },
    ];
  });
}

/**
 * Annual diluted EPS, oldest first. Falls back to basic EPS: some filers report
 * only that, and one share count is far better than an empty chart.
 */
function toAnnualEps(rows: FundamentalsRow[]): { year: number; eps: number | null }[] {
  return rows
    .map((row) => {
      const date = row.date instanceof Date ? row.date : new Date(String(row.date));
      if (Number.isNaN(date.getTime())) return null;
      const eps = row.dilutedEPS ?? row.basicEPS;
      return {
        year: date.getUTCFullYear(),
        eps: typeof eps === "number" && Number.isFinite(eps) ? eps : null,
      };
    })
    .filter((r): r is { year: number; eps: number | null } => r !== null)
    .sort((a, b) => a.year - b.year);
}

/**
 * Yahoo answering "there is nothing here", as opposed to failing to answer.
 *
 * - "no fundamentals data found" — every ETF, index and crypto pair.
 * - "quote not found" — delisted or unrecognised symbols.
 *
 * Both are final: retrying returns the same thing. Matched on the message
 * because the library throws a plain Error with no code to switch on.
 */
function isDefinitiveNoData(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /no fundamentals data found|quote not found/i.test(message);
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  const cached = analystCache.get(ticker) as AnalystData | undefined;
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const today = new Date().toISOString().split("T")[0];
  const quarterlyStart = new Date();
  quarterlyStart.setUTCFullYear(
    quarterlyStart.getUTCFullYear() - QUARTERLY_HISTORY_YEARS
  );

  // Settled, not all: the fundamentals history fails outright for ETFs and most
  // non-US listings, and that shouldn't cost us the rating and price target.
  const [summaryResult, annualResult, quarterlyResult] =
    await Promise.allSettled([
      yf.quoteSummary(
        ticker,
        {
          modules: [
            "financialData",
            "recommendationTrend",
            "earningsTrend",
            "earnings",
            "upgradeDowngradeHistory",
          ],
        },
        // Yahoo adds and drops fields without warning; a schema mismatch on one
        // module shouldn't blank the whole panel.
        { validateResult: false }
      ),
      yf.fundamentalsTimeSeries(ticker, {
        period1: EPS_HISTORY_START,
        period2: today,
        type: "annual",
        module: "all",
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: quarterlyStart.toISOString().split("T")[0],
        period2: today,
        type: "quarterly",
        module: "all",
      }),
    ]);

  const annualRows =
    annualResult.status === "fulfilled"
      ? (annualResult.value as FundamentalsRow[])
      : [];
  const quarterlyRows =
    quarterlyResult.status === "fulfilled"
      ? (quarterlyResult.value as FundamentalsRow[])
      : [];

  if (summaryResult.status === "rejected") {
    // A definitive "nothing here" is data, not a failure. Serving it as an
    // error would put a pointless Try again button in front of the user.
    if (!isDefinitiveNoData(summaryResult.reason)) {
      return NextResponse.json(
        { error: `Failed to fetch analyst data for ${ticker}` },
        { status: 502 }
      );
    }
    const empty = buildAnalystData(ticker, {});
    analystCache.set(ticker, empty);
    return NextResponse.json(empty, { headers: CACHE_HEADERS });
  }

  const summary = summaryResult.value as RawAnalystInput;
  const data = buildAnalystData(ticker, {
    financialData: summary.financialData,
    recommendationTrend: summary.recommendationTrend,
    earnings: summary.earnings,
    earningsTrend: summary.earningsTrend,
    upgradeDowngradeHistory: summary.upgradeDowngradeHistory,
    annualEps: toAnnualEps(annualRows),
    cashFlow: {
      annual: toCashFlowRows(annualRows),
      quarterly: toCashFlowRows(quarterlyRows),
    },
  });

  analystCache.set(ticker, data);
  return NextResponse.json(data, { headers: CACHE_HEADERS });
}
