// SEC requires a descriptive User-Agent on every request (it rejects requests
// without one) and asks callers to stay under ~10 req/s. Our usage is 1–2
// fetches per ticker, so no batching is needed.
const USER_AGENT =
  process.env.SEC_USER_AGENT ??
  "Oakstock financial dashboard (podolioukh.michael@gmail.com)";

async function secFetch(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Same politeness rules as secFetch, but returns the raw response body as text —
// used for SEC endpoints that serve XML (browse-edgar atom feeds, NPORT-P
// primary_doc.xml) rather than JSON.
export async function secFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/html" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

// The full ticker→CIK directory. Keys are upper-cased tickers, values are
// 10-digit zero-padded CIK strings (the format companyfacts URLs require).
export async function fetchTickerCikMap(): Promise<Record<string, string> | null> {
  const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!data || typeof data !== "object") return null;
  const map: Record<string, string> = {};
  for (const entry of Object.values(data as Record<string, TickerEntry>)) {
    if (!entry?.ticker || entry.cik_str == null) continue;
    map[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
  }
  return Object.keys(map).length ? map : null;
}

export async function fetchCompanyFacts(cik: string): Promise<unknown | null> {
  return secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
}

// Normalize a company name for fuzzy matching: upper-case, strip punctuation and
// common corporate suffixes so "Amazon.com Inc" and "AMAZON COM INC" collapse to
// the same key. Used to reverse-resolve NPORT holding names to tickers.
export function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,&/()\-]/g, " ")
    .replace(
      /\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|LLC|LP|HOLDINGS|HOLDING|GROUP|THE|CLASS [A-C]|CL [A-C]|COM|SA|NV|AG|SE)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// When several tickers share a normalized name (share classes, preferreds,
// linked notes), prefer the primary common listing: plain symbols first (no
// "-"/"." class suffix), then shortest, then alphabetical.
function primaryTicker(tickers: string[]): string {
  return [...tickers].sort((a, b) => {
    const sa = /[-.]/.test(a) ? 1 : 0;
    const sb = /[-.]/.test(b) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : 1;
  })[0];
}

// Reverse of the ticker directory: normalized company name -> best ticker.
// Lets us turn an NPORT holding's name into a link to its stock page.
export async function fetchNameTickerMap(): Promise<Record<string, string> | null> {
  const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!data || typeof data !== "object") return null;
  const groups: Record<string, string[]> = {};
  for (const entry of Object.values(data as Record<string, TickerEntry>)) {
    if (!entry?.ticker || !entry?.title) continue;
    const key = normalizeCompanyName(entry.title);
    if (!key) continue;
    (groups[key] = groups[key] ?? []).push(entry.ticker.toUpperCase());
  }
  const map: Record<string, string> = {};
  for (const [key, tickers] of Object.entries(groups)) {
    map[key] = primaryTicker(tickers);
  }
  return Object.keys(map).length ? map : null;
}

// SEC's mutual-fund/ETF ticker directory. Columnar JSON:
//   { fields: ["cik","seriesId","classId","symbol"], data: [[36405,"S000002839","C000092055","VOO"], ...] }
// Keys are upper-cased tickers; values carry the 10-digit CIK (for archive
// URLs) and the seriesId (used to filter NPORT-P filings to one fund).
export async function fetchFundTickerMap(): Promise<
  Record<string, { cik: string; seriesId: string }> | null
> {
  const data = await secFetch("https://www.sec.gov/files/company_tickers_mf.json");
  const rows = (data as { data?: unknown[][] } | null)?.data;
  if (!Array.isArray(rows)) return null;
  const map: Record<string, { cik: string; seriesId: string }> = {};
  for (const row of rows) {
    const [cik, seriesId, , symbol] = row as [number, string, string, string];
    if (!symbol || cik == null || !seriesId) continue;
    map[String(symbol).toUpperCase()] = {
      cik: String(cik).padStart(10, "0"),
      seriesId,
    };
  }
  return Object.keys(map).length ? map : null;
}
