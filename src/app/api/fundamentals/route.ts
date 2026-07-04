import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { fundamentalsCache } from "@/lib/cache";
import { getCik } from "@/lib/edgar/cik";
import { getEdgarFundamentals } from "@/lib/edgar";
import { mergeFundamentals } from "@/lib/edgar/merge";
import {
  markSync,
  persistFundamentals,
  readFreshFundamentals,
} from "@/lib/edgar/store";
import type { FinancialStatement, FundamentalsData } from "@/types";
import { ApiError, apiHandler, withTimeout } from "@/lib/apiHandler";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const YAHOO_TIMEOUT_MS = 20_000;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

function toAbsOrNull(v: number | undefined | null): number | null {
  return v != null ? Math.abs(v) : null;
}

function mapStatement(raw: Record<string, unknown>): FinancialStatement {
  return {
    date: (raw.date as Date)?.toISOString?.() ?? String(raw.date),
    revenue: (raw.totalRevenue as number) ?? null,
    ebitda: (raw.EBITDA as number) ?? null,
    freeCashFlow: (raw.freeCashFlow as number) ?? null,
    operatingCashFlow:
      (raw.operatingCashFlow as number) ??
      (raw.cashFlowFromContinuingOperatingActivities as number) ??
      null,
    capex: toAbsOrNull(raw.capitalExpenditure as number | undefined),
    netIncome: (raw.netIncome as number) ?? null,
    grossProfit: (raw.grossProfit as number) ?? null,
    operatingIncome: (raw.operatingIncome as number) ?? null,
    costOfRevenue: (raw.costOfRevenue as number) ?? null,
    eps: (raw.dilutedEPS as number) ?? null,
    epsBasic: (raw.basicEPS as number) ?? null,
    buybacks: toAbsOrNull(raw.repurchaseOfCapitalStock as number | undefined),
    dividendsPaid: toAbsOrNull((raw.commonStockDividendPaid ?? raw.cashDividendsPaid) as number | undefined),
    totalDebt: (raw.totalDebt as number) ?? null,
    stockholdersEquity: (raw.stockholdersEquity as number) ?? null,
  };
}

// Fetch Yahoo fundamentals as a FundamentalsData. Used both as the standalone
// fallback (tickers EDGAR doesn't cover) and as a gap-filler layered on top of
// EDGAR. period1 reaches well back so Yahoo can backfill older years too;
// Yahoo simply returns whatever history it has.
async function fetchYahooFundamentals(
  ticker: string,
): Promise<FundamentalsData | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [quarterlyRaw, annualRaw] = await withTimeout(
      Promise.all([
        yf.fundamentalsTimeSeries(ticker, {
          period1: "2001-01-01",
          period2: today,
          type: "quarterly",
          module: "all",
        }),
        yf.fundamentalsTimeSeries(ticker, {
          period1: "2001-01-01",
          period2: today,
          type: "annual",
          module: "all",
        }),
      ]),
      YAHOO_TIMEOUT_MS,
      `fundamentalsTimeSeries(${ticker})`
    );

    const quarterly = (quarterlyRaw as Record<string, unknown>[])
      .map(mapStatement)
      .sort((a, b) => a.date.localeCompare(b.date));
    const annual = (annualRaw as Record<string, unknown>[])
      .map(mapStatement)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (quarterly.length === 0 && annual.length === 0) return null;
    return { ticker, quarterly, annual };
  } catch (err) {
    console.warn(
      `[api/fundamentals] yahoo fetch failed for ${ticker}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export const GET = apiHandler("fundamentals", async (request: NextRequest) => {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    throw new ApiError(400, "ticker parameter is required");
  }

  const cached = fundamentalsCache.get(ticker);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  const respond = (data: FundamentalsData) => {
    fundamentalsCache.set(ticker, data as unknown as Record<string, unknown>);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  };

  // 1. Serve from Supabase when persisted data is recent enough.
  try {
    const fresh = await readFreshFundamentals(ticker);
    if (fresh.status === "fresh") {
      if (fresh.data) return respond(fresh.data);
      // Recently confirmed no data anywhere — don't re-hit upstreams.
      return NextResponse.json(
        { error: `No financial data available for ${ticker}` },
        { status: 404 },
      );
    }
  } catch (err) {
    // DB unavailable — fall through to a live fetch.
    console.warn(
      `[api/fundamentals] supabase read failed for ${ticker}:`,
      err instanceof Error ? err.message : err
    );
  }

  // 2. Primary source: SEC EDGAR (~15+ years of history). Where EDGAR leaves
  //    cells null (tags it doesn't cover, or metrics like EBITDA it can't
  //    derive), fill them from Yahoo so years aren't left partially blank.
  try {
    const cik = await getCik(ticker);
    if (cik) {
      const edgar = await getEdgarFundamentals(ticker);
      if (edgar) {
        const yahoo = await fetchYahooFundamentals(ticker);
        const data = yahoo ? mergeFundamentals(edgar, yahoo) : edgar;
        await persistFundamentals(cik, "edgar", data);
        return respond(data);
      }
    }
  } catch (err) {
    // fall through to Yahoo
    console.warn(
      `[api/fundamentals] edgar fetch failed for ${ticker}:`,
      err instanceof Error ? err.message : err
    );
  }

  // 3. Fallback: Yahoo (for tickers EDGAR doesn't cover). Persist on success.
  const yahoo = await fetchYahooFundamentals(ticker);
  if (yahoo) {
    await persistFundamentals(null, "yahoo", yahoo);
    return respond(yahoo);
  }

  // 4. Nothing anywhere — record so we don't retry on every load.
  await markSync(ticker, null, "none");
  throw new ApiError(500, `Failed to fetch fundamentals for ${ticker}`);
});
