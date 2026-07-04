import { NextResponse } from "next/server";
import { parseInsiderFeed } from "@/lib/finviz/insiderTrading";

// Finviz's buys-only insider feed (tc=1). Still contains injected ad rows and the
// occasional non-buy, so we filter to action === "buy" below.
const FINVIZ_BUYS_FEED = "https://finviz.com/insidertrading.ashx?tc=1";
// Finviz rejects bare/script fetches — present as a normal browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

// Drop routine sub-$50k buys to keep the panel meaningful; cap the list length.
const MIN_VALUE = 50_000;
const MAX_ROWS = 30;

export const revalidate = 1800; // 30 min

// GET /api/alerts/insider-buying
// Market-wide recent insider BUYS across all companies, scraped from Finviz.
export async function GET() {
  try {
    const res = await fetch(FINVIZ_BUYS_FEED, {
      headers: BROWSER_HEADERS,
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Finviz ${res.status}` }, { status: 502 });
    }

    const trades = parseInsiderFeed(await res.text())
      .filter((t) => t.action === "buy" && t.value >= MIN_VALUE)
      .slice(0, MAX_ROWS);

    return NextResponse.json({ trades });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
