import { NextResponse } from "next/server";
import { createHash } from "crypto";
import Parser from "rss-parser";
import type { MacroNewsItem } from "@/types/news";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

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

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(({ source, url }) => fetchFeed(source, url))
  );

  let succeeded = 0;
  const all: MacroNewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      succeeded += 1;
      all.push(...result.value);
    }
  }

  // Deduplicate by case-insensitive title, keeping the first occurrence.
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

  console.log(`Fetched ${deduped.length} macro news items from ${succeeded} feeds`);

  return NextResponse.json(deduped, { headers: CACHE_HEADERS });
}
