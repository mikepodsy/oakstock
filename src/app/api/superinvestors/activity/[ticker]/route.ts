import { NextRequest, NextResponse } from "next/server";
import {
  parseStockActivity,
  type Action,
} from "@/lib/dataroma/stockActivity";

const DATAROMA_STOCK = "https://www.dataroma.com/m/stock.php?sym=";
// Dataroma rejects bare/script fetches — present as a normal browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

// GET /api/superinvestors/activity/[ticker]?action=buy|sell
// Scrapes Dataroma's per-stock page and returns the funds that recently bought
// (or sold) the ticker. One page per ticker on demand — cached for an hour via
// Next fetch revalidation rather than a Supabase table.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const actionParam = request.nextUrl.searchParams.get("action");
  const action: Action = actionParam === "sell" ? "sell" : "buy";

  try {
    const res = await fetch(DATAROMA_STOCK + encodeURIComponent(ticker), {
      headers: BROWSER_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Dataroma ${res.status}` },
        { status: 502 },
      );
    }

    const parsed = parseStockActivity(await res.text());
    return NextResponse.json({
      ticker: parsed.ticker || ticker,
      company_name: parsed.company_name,
      action,
      funds: parsed.funds[action],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
