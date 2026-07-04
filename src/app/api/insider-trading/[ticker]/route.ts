import { NextRequest, NextResponse } from "next/server";
import { parseInsiderTrades } from "@/lib/finviz/insiderTrading";

const FINVIZ_QUOTE = "https://finviz.com/quote.ashx?t=";
// Finviz rejects bare/script fetches — present as a normal browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

// Cap the list so the panel stays scannable; Finviz returns them newest-first.
const MAX_TRADES = 15;

// GET /api/insider-trading/[ticker]
// Scrapes the insider-trading table from Finviz's per-stock quote page and
// returns that ticker's most recent insider transactions. One page per ticker
// on demand — cached for an hour via Next fetch revalidation.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    const res = await fetch(FINVIZ_QUOTE + encodeURIComponent(ticker), {
      headers: BROWSER_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Finviz ${res.status}` },
        { status: 502 },
      );
    }

    const trades = parseInsiderTrades(await res.text()).slice(0, MAX_TRADES);
    return NextResponse.json({ ticker, trades });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
