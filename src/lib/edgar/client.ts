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
