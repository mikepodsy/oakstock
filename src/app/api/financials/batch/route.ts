import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { dividendBatchCache } from "@/lib/cache";

const yf = new YahooFinance();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900",
};

const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BatchResult {
  ticker: string;
  dividendYield: number | null;
  dividendRate: number | null;
  currentPrice: number | null;
  error?: boolean;
}

async function fetchOne(ticker: string): Promise<BatchResult> {
  const cached = dividendBatchCache.get(ticker);
  if (cached) {
    return cached;
  }

  try {
    const summary = await yf.quoteSummary(ticker, {
      modules: ["summaryDetail", "price"],
    });

    // Dividend figures come from summaryDetail — defaultKeyStatistics carries
    // neither dividendYield nor dividendRate, so reading them there was
    // silently nulling every row.
    const detail = summary.summaryDetail;
    const price = summary.price;

    const yieldVal = detail?.dividendYield;
    const rateVal = detail?.dividendRate;
    const priceVal = price?.regularMarketPrice;

    const result: BatchResult = {
      ticker,
      dividendYield: typeof yieldVal === "number" ? yieldVal : null,
      dividendRate: typeof rateVal === "number" ? rateVal : null,
      currentPrice: typeof priceVal === "number" ? priceVal : null,
    };

    dividendBatchCache.set(ticker, result);
    return result;
  } catch {
    return { ticker, dividendYield: null, dividendRate: null, currentPrice: null, error: true };
  }
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parameter is required" },
      { status: 400 }
    );
  }

  const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json([], { headers: CACHE_HEADERS });
  }

  const results: BatchResult[] = [];

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(fetchOne));
    results.push(...chunkResults);

    if (i + CHUNK_SIZE < tickers.length) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  return NextResponse.json(results, { headers: CACHE_HEADERS });
}
