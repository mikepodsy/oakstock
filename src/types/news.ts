// ─── News ────────────────────────────────────────────
// Normalized news item shared by the /api/news/* routes and the
// news components. Stock items carry their related tickers; macro
// items do not.

export interface BaseNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string; // ISO date string
}

export interface StockNewsItem extends BaseNewsItem {
  type: "stock";
  symbols: string[];
}

export interface MacroNewsItem extends BaseNewsItem {
  type: "macro";
}

export type NewsItem = StockNewsItem | MacroNewsItem;

// Tailwind badge classes keyed by normalized source label. Falls back
// to NEWS_SOURCE_DEFAULT_BADGE for any source not listed here.
export const NEWS_SOURCE_BADGE: Record<string, string> = {
  WSJ: "bg-blue-500/15 text-blue-500",
  "Barron's": "bg-orange-500/15 text-orange-500",
  MarketWatch: "bg-green-500/15 text-green-500",
  CNBC: "bg-sky-500/15 text-sky-500",
  "Yahoo Finance": "bg-violet-500/15 text-violet-500",
};

// Purple is the default for Alpaca/other stock-news sources.
export const NEWS_SOURCE_DEFAULT_BADGE = "bg-purple-500/15 text-purple-500";

export function newsSourceBadgeClass(source: string): string {
  return NEWS_SOURCE_BADGE[source] ?? NEWS_SOURCE_DEFAULT_BADGE;
}
