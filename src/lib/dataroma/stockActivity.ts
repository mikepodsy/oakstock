// Pure parser for Dataroma's per-stock superinvestor page (stock.php?sym=XXX).
// No fetching here — keeps it trivially testable and reusable, mirroring
// grandPortfolio.ts.

/** Recent-trade classification of a holder. `null` = held with no recent change. */
export type Action = "buy" | "sell";
/** A page "view": the funds that own / bought / sold the stock. */
export type ActivityView = "own" | "buy" | "sell";

export interface FundActivity {
  /** Full label, e.g. "Warren Buffett - Berkshire Hathaway". */
  manager: string;
  /** Dataroma fund code from holdings.php?m=CODE, e.g. "BRK". */
  managerCode: string;
  /** Raw activity label, e.g. "Buy", "Add 4.41%", "Reduce 10.55%", or "". */
  activity: string;
  /** buy/sell classification of the activity label, or null if no recent trade. */
  action: Action | null;
  pct_portfolio: number;
  shares: number;
  value_usd: number;
}

export interface ParsedStockActivity {
  /** Ticker as shown on the page, e.g. "AAPL". */
  ticker: string;
  /** Clean company name without the ticker suffix, e.g. "Apple Inc.". */
  company_name: string;
  /** Every superinvestor holding the stock, in Dataroma's order (% of portfolio desc). */
  holders: FundActivity[];
}

/** Filter parsed holders down to a page view (own = all, buy/sell = by activity). */
export function selectFunds(
  parsed: ParsedStockActivity,
  view: ActivityView,
): FundActivity[] {
  if (view === "own") return parsed.holders;
  return parsed.holders.filter((f) => f.action === view);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8801;?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classify a "Recent activity" label into a buy/sell bucket.
 * "Buy" / "Add x%" → buy, "Sell" / "Reduce x%" → sell, blank → null (no trade).
 */
export function classifyActivity(raw: string): Action | null {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("buy") || t.startsWith("add")) return "buy";
  if (t.startsWith("sell") || t.startsWith("reduce")) return "sell";
  return null;
}

/**
 * Parse a Dataroma stock page into the funds that recently bought or sold it.
 * Funds with no recent activity are omitted from both buckets.
 */
export function parseStockActivity(html: string): ParsedStockActivity {
  // Name + ticker: <p id="st_name">Apple Inc. (AAPL)</p>
  const nameRaw = /<p[^>]*id="st_name"[^>]*>([^<]*)<\/p>/i.exec(html)?.[1] ?? "";
  const nameMatch = /^(.*?)\s*\(([A-Z0-9.\-]+)\)\s*$/.exec(stripTags(nameRaw));
  const company_name = nameMatch ? nameMatch[1].trim() : stripTags(nameRaw);
  const ticker = nameMatch ? nameMatch[2].trim() : "";

  const holders: FundActivity[] = [];

  // Holdings live in <table id="grid"> … the <tbody> holds one <tr> per fund.
  const grid = /<table[^>]*id="grid"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!grid) return { ticker, company_name, holders };
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(grid)?.[1] ?? "";

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const row = rowMatch[1];

    // Firm cell: <a href="/m/holdings.php?m=BRK" …>Warren Buffett - …</a>
    const firm = /holdings\.php\?m=([^"&]+)"[^>]*>([^<]+)</i.exec(row);
    if (!firm) continue;

    // Cells in order: hist, firm, %, activity, shares, value.
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      stripTags(c[1]),
    );
    if (cells.length < 6) continue;

    const activity = cells[3];
    holders.push({
      manager: stripTags(firm[2]).trim(),
      managerCode: firm[1].trim(),
      activity,
      action: classifyActivity(activity),
      pct_portfolio: toNumber(cells[2]),
      shares: Math.round(toNumber(cells[4])),
      value_usd: Math.round(toNumber(cells[5])),
    });
  }

  return { ticker, company_name, holders };
}
