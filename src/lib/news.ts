import { createHash } from "crypto";
import Parser from "rss-parser";
import type { MacroNewsItem, StockNewsItem } from "@/types/news";

// ─── Macro / market news (RSS) ──────────────────────────
// Source label drives the badge color in the UI. The original spec's
// feed URLs (feeds.reuters.com and feeds.content.dowjones.io/.../mktw_*)
// are all discontinued / 404, so these are validated working replacements.
const FEEDS: { source: string; url: string }[] = [
  { source: "WSJ", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { source: "WSJ", url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml" },
  { source: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/" },
  { source: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/marketpulse/" },
  { source: "CNBC", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { source: "CNBC", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
];

const parser = new Parser({ timeout: 10_000 });

function hashId(title: string): string {
  return createHash("sha1").update(title).digest("hex");
}

async function fetchFeed(source: string, url: string): Promise<MacroNewsItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      id: hashId(item.title as string),
      title: (item.title as string).trim(),
      summary: (item.contentSnippet ?? "").trim(),
      url: item.link as string,
      source,
      publishedAt: item.isoDate ?? new Date(item.pubDate ?? Date.now()).toISOString(),
      type: "macro" as const,
    }));
}

/**
 * Fetch and normalize macro/market news from the configured RSS feeds.
 * Resilient: feeds that fail are skipped. Results are deduped by
 * case-insensitive title and sorted newest-first.
 */
export async function fetchMacroNews(): Promise<MacroNewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(({ source, url }) => fetchFeed(source, url))
  );

  const all: MacroNewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") all.push(...result.value);
  }

  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return deduped;
}

// ─── Stock news (Alpaca) ────────────────────────────────
const ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news";

interface AlpacaNewsArticle {
  id: number | string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  created_at: string;
  symbols: string[];
}

function normalizeStock(article: AlpacaNewsArticle): StockNewsItem {
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

/**
 * Fetch and normalize Alpaca news for the given symbols. Returns an empty
 * array when no symbols are given or credentials are missing/the request
 * fails — callers treat news as best-effort.
 */
export async function fetchStockNews(symbols: string[]): Promise<StockNewsItem[]> {
  const clean = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (clean.length === 0) return [];

  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !secretKey) {
    console.error("[news] ALPACA_API_KEY / ALPACA_SECRET_KEY not configured");
    return [];
  }

  try {
    const url = new URL(ALPACA_NEWS_URL);
    url.searchParams.set("symbols", clean.join(","));
    url.searchParams.set("limit", "20");

    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[news] Alpaca API error ${res.status}: ${await res.text()}`);
      return [];
    }

    const raw = await res.json();
    const articles: AlpacaNewsArticle[] = Array.isArray(raw?.news) ? raw.news : [];
    return articles.map(normalizeStock);
  } catch (err) {
    console.error("[news] Failed to fetch Alpaca news:", err);
    return [];
  }
}
