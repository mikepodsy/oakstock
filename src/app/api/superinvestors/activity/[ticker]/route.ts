import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
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
    const funds = parsed.funds[action];

    // Resolve real fund logos: Dataroma's firm code (?m=CODE) matches our roster's
    // expert_managers.dataroma_code, which carries the brand logo domain. Funds
    // outside the roster have no known domain and fall back to an initials avatar.
    const codes = [...new Set(funds.map((f) => f.managerCode))];
    const logoByCode = new Map<string, string>();
    if (codes.length) {
      const supabase = createServerSupabaseClient();
      const { data: rows } = await supabase
        .from("expert_managers")
        .select("dataroma_code, logo_domain")
        .in("dataroma_code", codes);
      for (const r of rows ?? []) {
        if (r.logo_domain) logoByCode.set(r.dataroma_code, r.logo_domain);
      }
    }

    return NextResponse.json({
      ticker: parsed.ticker || ticker,
      company_name: parsed.company_name,
      action,
      funds: funds.map((f) => ({
        ...f,
        logoDomain: logoByCode.get(f.managerCode) ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
