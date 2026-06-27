// Pure parser + config for Dataroma's "grand portfolio" aggregate tables.
// No fetching here — keeps it trivially testable and reusable.

export type WidgetKey =
  | "most_owned"
  | "buys_1q"
  | "buys_2q"
  | "sells_1q"
  | "sells_2q";

export interface WidgetConfig {
  key: WidgetKey;
  title: string;
  /** path relative to https://www.dataroma.com/m/ */
  path: string;
  /** header label of the metric/count column on that page */
  metricHeader: string;
  /** short verb for the count badge, e.g. "own" / "buy" / "sell" */
  metricVerb: string;
}

export const WIDGETS: WidgetConfig[] = [
  { key: "most_owned", title: "Most Owned",         path: "g/portfolio.php?o=c",        metricHeader: "Ownership", metricVerb: "own"  },
  { key: "buys_1q",    title: "Buys · Last Qtr",     path: "g/portfolio_b.php?q=q&o=c",  metricHeader: "Buys",      metricVerb: "buy"  },
  { key: "buys_2q",    title: "Buys · Last 2 Qtrs",  path: "g/portfolio_b.php?q=h&o=c",  metricHeader: "Buys",      metricVerb: "buy"  },
  { key: "sells_1q",   title: "Sells · Last Qtr",    path: "g/portfolio_s.php?q=q&o=c",  metricHeader: "Sells",     metricVerb: "sell" },
  { key: "sells_2q",   title: "Sells · Last 2 Qtrs", path: "g/portfolio_s.php?q=h&o=c",  metricHeader: "Sells",     metricVerb: "sell" },
];

export interface SummaryRow {
  rank: number;
  ticker: string;
  company_name: string;
  metric: number;
}

export interface ParsedTable {
  quarter: string | null;
  rows: SummaryRow[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#9660;?/g, "") // sort-arrow glyph in header cells
    .replace(/\s+/g, " ")
    .trim();
}

function toInt(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a Dataroma grand-portfolio page. Returns the top `limit` rows.
 * Columns are located by matching the header row labels, so an extra
 * column (e.g. most-owned's "Max %") doesn't shift the metric index.
 */
export function parseGrandPortfolio(
  html: string,
  metricHeader: string,
  limit = 10,
): ParsedTable {
  const quarter =
    /\bQ[1-4]\s+\d{4}\b/.exec(stripTags(html.slice(0, 8000)))?.[0] ?? null;

  const rows: SummaryRow[] = [];

  // Collect every table row's cell text.
  const all: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) => stripTags(c[1]),
    );
    if (cells.length) all.push(cells);
  }

  // Locate the header row and resolve column indices by label.
  const headerRow = all.find((r) => r.some((c) => /^symbol$/i.test(c)));
  let symbolIdx = -1;
  let stockIdx = -1;
  let metricIdx = -1;
  if (headerRow) {
    symbolIdx = headerRow.findIndex((c) => /^symbol$/i.test(c));
    stockIdx = headerRow.findIndex((c) => /^stock$/i.test(c));
    metricIdx = headerRow.findIndex((c) =>
      c.toLowerCase().startsWith(metricHeader.toLowerCase()),
    );
  }
  if (symbolIdx < 0 || metricIdx < 0) return { quarter, rows: [] };

  for (const cells of all) {
    if (cells === headerRow) continue;
    const ticker = cells[symbolIdx]?.trim();
    // Data rows carry a ticker symbol in the symbol column.
    if (!ticker || !/^[A-Z][A-Z0-9.\-]*$/.test(ticker)) continue;
    rows.push({
      rank: rows.length + 1,
      ticker,
      company_name: stockIdx >= 0 ? (cells[stockIdx] ?? "").trim() : "",
      metric: toInt(cells[metricIdx] ?? ""),
    });
    if (rows.length >= limit) break;
  }

  return { quarter, rows };
}
