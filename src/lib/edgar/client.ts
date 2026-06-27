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
