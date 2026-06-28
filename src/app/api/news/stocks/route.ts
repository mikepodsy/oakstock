import { NextRequest, NextResponse } from "next/server";
import type { StockNewsItem } from "@/types/news";

const ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

interface AlpacaNewsArticle {
  id: number | string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  created_at: string;
  symbols: string[];
}

function normalize(article: AlpacaNewsArticle): StockNewsItem {
  return {
    id: String(article.id),
    title: article.headline ?? "",
    summary: article.summary ?? "",
    url: article.url ?? "",
    source: article.source || "Alpaca",
    publishedAt: article.created_at,
    symbols: Array.isArray(article.symbols) ? article.symbols : [],
    type: "stock",
  };
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols");
  const symbols = (symbolsParam ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json([], { headers: CACHE_HEADERS });
  }

  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !secretKey) {
    console.error("[news/stocks] ALPACA_API_KEY / ALPACA_SECRET_KEY not configured");
    return NextResponse.json([], { headers: CACHE_HEADERS });
  }

  try {
    const url = new URL(ALPACA_NEWS_URL);
    url.searchParams.set("symbols", symbols.join(","));
    url.searchParams.set("limit", "20");

    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[news/stocks] Alpaca API error ${res.status}: ${await res.text()}`);
      return NextResponse.json([], { headers: CACHE_HEADERS });
    }

    const raw = await res.json();
    const articles: AlpacaNewsArticle[] = Array.isArray(raw?.news) ? raw.news : [];
    const items = articles.map(normalize);

    return NextResponse.json(items, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[news/stocks] Failed to fetch Alpaca news:", err);
    return NextResponse.json([], { headers: CACHE_HEADERS });
  }
}
