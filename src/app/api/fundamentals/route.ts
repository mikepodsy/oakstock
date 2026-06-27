import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { fundamentalsCache } from "@/lib/cache";
import { getCik } from "@/lib/edgar/cik";
import { getEdgarFundamentals } from "@/lib/edgar";
import {
  markSync,
  persistFundamentals,
  readFreshFundamentals,
} from "@/lib/edgar/store";
import type { FinancialStatement, FundamentalsData } from "@/types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

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

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
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
  } catch {
    // DB unavailable — fall through to a live fetch.
  }

  // 2. Primary source: SEC EDGAR (~15+ years of history). Persist on success.
  try {
    const cik = await getCik(ticker);
    if (cik) {
      const edgar = await getEdgarFundamentals(ticker);
      if (edgar) {
        await persistFundamentals(cik, "edgar", edgar);
        return respond(edgar);
      }
    }
  } catch {
    // fall through to Yahoo
  }

  // 3. Fallback: Yahoo (for tickers EDGAR doesn't cover). Persist on success.
  try {
    const today = new Date().toISOString().split("T")[0];
    const [quarterlyRaw, annualRaw] = await Promise.all([
      yf.fundamentalsTimeSeries(ticker, {
        period1: "2018-01-01",
        period2: today,
        type: "quarterly",
        module: "all",
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: "2018-01-01",
        period2: today,
        type: "annual",
        module: "all",
      }),
    ]);

    const quarterly = (quarterlyRaw as Record<string, unknown>[])
      .map(mapStatement)
      .sort((a, b) => a.date.localeCompare(b.date));

    const annual = (annualRaw as Record<string, unknown>[])
      .map(mapStatement)
      .sort((a, b) => a.date.localeCompare(b.date));

    const data: FundamentalsData = { ticker, quarterly, annual };
    await persistFundamentals(null, "yahoo", data);
    return respond(data);
  } catch {
    // 4. Nothing anywhere — record so we don't retry on every load.
    await markSync(ticker, null, "none");
    return NextResponse.json(
      { error: `Failed to fetch fundamentals for ${ticker}` },
      { status: 500 }
    );
  }
}
