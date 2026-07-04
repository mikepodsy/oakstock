import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { quoteCache } from "@/lib/cache";
import { ApiError, apiHandler, withTimeout } from "@/lib/apiHandler";

const yf = new YahooFinance();

const YAHOO_TIMEOUT_MS = 10_000;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
};

type ExtendedHours = {
  session: "pre" | "post";
  changePercent: number;
  price: number;
};

// Build the contextual pre/post-market box from a Yahoo price-like object.
// `scale` is 100 for quoteSummary (percents come as decimals) and 1 for
// quote() (already in percent form).
function buildExtendedHours(
  src: Record<string, unknown>,
  scale: number
): ExtendedHours | undefined {
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const state = typeof src.marketState === "string" ? src.marketState : "";

  if (state === "PRE" || state === "PREPRE") {
    const pct = num(src.preMarketChangePercent);
    if (pct !== undefined) {
      return {
        session: "pre",
        changePercent: pct * scale,
        price: num(src.preMarketPrice) ?? 0,
      };
    }
  } else if (state === "POST" || state === "POSTPOST") {
    const pct = num(src.postMarketChangePercent);
    if (pct !== undefined) {
      return {
        session: "post",
        changePercent: pct * scale,
        price: num(src.postMarketPrice) ?? 0,
      };
    }
  }

  return undefined;
}

async function fetchSingleQuote(ticker: string) {
  const cached = quoteCache.get(ticker);
  if (cached) return cached;
  try {
    const summary = await withTimeout(
      yf.quoteSummary(ticker, {
        modules: ["price", "assetProfile", "summaryDetail"],
      }),
      YAHOO_TIMEOUT_MS,
      `quoteSummary(${ticker})`
    );

    const price = summary.price;
    const profile = summary.assetProfile;
    const detail = summary.summaryDetail;

    const data = {
      ticker: price?.symbol ?? ticker,
      name: price?.shortName ?? price?.longName ?? ticker,
      currentPrice: price?.regularMarketPrice ?? 0,
      previousClose: price?.regularMarketPreviousClose ?? 0,
      dayChange: price?.regularMarketChange ?? 0,
      dayChangePercent: price?.regularMarketChangePercent
        ? price.regularMarketChangePercent * 100
        : 0,
      marketCap: price?.marketCap ?? undefined,
      peRatio: detail?.trailingPE ?? undefined,
      fiftyTwoWeekHigh: detail?.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: detail?.fiftyTwoWeekLow ?? undefined,
      sector: profile?.sector ?? undefined,
      website: profile?.website ?? undefined,
      currency: price?.currency ?? "USD",
      extendedHours: price ? buildExtendedHours(price, 100) : undefined,
    };
    quoteCache.set(ticker, data);
    return data;
  } catch (err) {
    // Fallback to quote() for indices and unsupported tickers
    console.warn(
      `[api/quotes] quoteSummary(${ticker}) failed, falling back to quote():`,
      err instanceof Error ? err.message : err
    );
    const result = await withTimeout(
      yf.quote(ticker),
      YAHOO_TIMEOUT_MS,
      `quote(${ticker})`
    );
    const data = {
      ticker: result.symbol,
      name: result.shortName ?? result.longName ?? result.symbol,
      currentPrice: result.regularMarketPrice ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      dayChange: result.regularMarketChange ?? 0,
      dayChangePercent: result.regularMarketChangePercent ?? 0,
      marketCap: result.marketCap ?? undefined,
      peRatio: result.trailingPE ?? undefined,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? undefined,
      sector: undefined,
      currency: result.currency ?? "USD",
      extendedHours: buildExtendedHours(result, 1),
    };
    quoteCache.set(ticker, data);
    return data;
  }
}

export const GET = apiHandler("quotes", async (request: NextRequest) => {
  const tickersParam = request.nextUrl.searchParams.get("tickers");

  if (!tickersParam) {
    throw new ApiError(400, "tickers parameter is required");
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    throw new ApiError(400, "at least one ticker is required");
  }

  // Process in batches of 20 to avoid overwhelming Yahoo Finance
  const BATCH_SIZE = 20;
  const quotes: Awaited<ReturnType<typeof fetchSingleQuote>>[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((t) => fetchSingleQuote(t))
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        quotes.push(r.value);
      } else {
        console.warn(
          `[api/quotes] dropping ${batch[idx]}:`,
          r.reason instanceof Error ? r.reason.message : r.reason
        );
      }
    });
  }

  return NextResponse.json(quotes, { headers: CACHE_HEADERS });
});
