import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { fundamentalsCache } from "@/lib/cache";
import type { FinancialStatement } from "@/types";

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
    netIncome: (raw.netIncome as number) ?? null,
    grossProfit: (raw.grossProfit as number) ?? null,
    operatingIncome: (raw.operatingIncome as number) ?? null,
    costOfRevenue: (raw.costOfRevenue as number) ?? null,
    eps: (raw.dilutedEPS as number) ?? null,
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

    const data = { ticker, quarterly, annual };
    fundamentalsCache.set(ticker, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch fundamentals for ${ticker}` },
      { status: 500 }
    );
  }
}
