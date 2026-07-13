import { XMLParser } from "fast-xml-parser";
import { edgarFundCache } from "@/lib/cache";
import { getCik } from "./cik";
import { fetchFundTickerMap, secFetchText } from "./client";

// A single ETF constituent, as reported in the fund's NPORT-P filing.
export interface EtfHolding {
  name: string;
  title: string | null; // issuer's security title (e.g. "UNITED AIRLINES")
  cusip: string | null;
  valUSD: number; // market value of this position in USD
}

export interface EtfHoldingsResult {
  ticker: string;
  asOf: string; // NPORT-P filing date (YYYY-MM-DD)
  totalValue: number; // Σ valUSD of ALL holdings — the pie's denominator
  holdingsCount: number; // total number of positions in the filing
  holdings: EtfHolding[]; // largest positions, sorted by valUSD desc (capped)
}

// Bond ETFs report tens of thousands of individual lots; the pie only needs the
// largest names, so we cap what leaves the server (totalValue/holdingsCount
// still reflect the full filing so the "Other" slice stays accurate).
const RETURN_LIMIT = 100;

// parseTagValue:false keeps every leaf as a string so CUSIPs don't lose leading
// zeros; we Number() the numeric fields we actually need ourselves.
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});

function cleanText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

// Resolve an ETF/mutual-fund ticker to its SEC filer identity. Returns null when
// the ticker isn't a registered fund (i.e. an ordinary stock). The whole fund
// directory is fetched once and cached for a day under a single key.
export async function getFundIdentity(
  ticker: string,
): Promise<{ cik: string; seriesId: string } | null> {
  let map = edgarFundCache.get("map");
  if (map === undefined) {
    map = await fetchFundTickerMap();
    edgarFundCache.set("map", map); // cache null too, so a failed fetch isn't retried every request
  }
  return map?.[ticker.toUpperCase()] ?? null;
}

// Find the most recent NPORT-P filing for one fund. `filerId` is either a
// seriesId (S000…) — which makes browse-edgar return just that series' filings,
// the right choice when a trust holds many funds — or a plain trust CIK, used
// for single-fund trusts (e.g. SPY) that aren't in the series/class fund map.
async function getLatestNportAccession(
  filerId: string,
): Promise<{ accession: string; filingDate: string } | null> {
  const url =
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filerId}` +
    `&type=NPORT-P&dateb=&owner=include&count=1&output=atom`;
  const text = await secFetchText(url);
  if (!text) return null;

  const feed = xml.parse(text) as {
    feed?: { entry?: unknown | unknown[] };
  };
  const entries = feed?.feed?.entry;
  const first = Array.isArray(entries) ? entries[0] : entries;
  const content = (first as { content?: Record<string, unknown> } | undefined)
    ?.content;
  const accession = content?.["accession-number"];
  const filingType = String(content?.["filing-type"] ?? "");
  if (!accession || !filingType.startsWith("NPORT-P")) return null;

  return {
    accession: String(accession),
    filingDate: String(content?.["filing-date"] ?? ""),
  };
}

// Fetch and parse the holdings out of a filing's primary_doc.xml (the NPORT-P
// form body). Short positions and non-positive values are dropped so slice
// weights sum cleanly.
async function fetchNportHoldings(
  cik: string,
  accession: string,
): Promise<{ holdings: EtfHolding[]; totalValue: number; holdingsCount: number } | null> {
  const accNoDash = accession.replace(/-/g, "");
  const cikNum = String(Number(cik)); // archive paths use the un-padded CIK
  const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDash}/primary_doc.xml`;
  const text = await secFetchText(url);
  if (!text) return null;

  const doc = xml.parse(text) as {
    edgarSubmission?: {
      formData?: { invstOrSecs?: { invstOrSec?: unknown | unknown[] } };
    };
  };
  const raw = doc?.edgarSubmission?.formData?.invstOrSecs?.invstOrSec;
  if (!raw) return null;
  const rows = Array.isArray(raw) ? raw : [raw];

  const holdings: EtfHolding[] = [];
  for (const r of rows) {
    const h = r as Record<string, unknown>;
    const valUSD = Number(h.valUSD);
    if (!Number.isFinite(valUSD) || valUSD <= 0) continue;
    if (h.payoffProfile === "Short") continue;
    holdings.push({
      name: cleanText(h.name) ?? cleanText(h.title) ?? "Unknown",
      title: cleanText(h.title),
      cusip: h.cusip != null ? String(h.cusip) : null,
      valUSD,
    });
  }
  if (holdings.length === 0) return null;

  holdings.sort((a, b) => b.valUSD - a.valUSD);
  const totalValue = holdings.reduce((sum, h) => sum + h.valUSD, 0);
  return {
    holdings: holdings.slice(0, RETURN_LIMIT),
    totalValue,
    holdingsCount: holdings.length,
  };
}

// Full pipeline: ticker → filer → latest NPORT-P → parsed holdings. Returns null
// at any dead end (not a fund, no NPORT-P on file, empty holdings).
export async function getEtfHoldings(
  ticker: string,
): Promise<EtfHoldingsResult | null> {
  // Preferred path: series/class-registered funds (covers most ETFs). Fall back
  // to the trust CIK for single-fund trusts (SPY, DIA) absent from the fund map.
  const identity = await getFundIdentity(ticker);
  let cik: string | null;
  let filerId: string | null;
  if (identity) {
    cik = identity.cik;
    filerId = identity.seriesId;
  } else {
    cik = await getCik(ticker);
    filerId = cik;
  }
  if (!cik || !filerId) return null;

  const latest = await getLatestNportAccession(filerId);
  if (!latest) return null;

  const parsed = await fetchNportHoldings(cik, latest.accession);
  if (!parsed) return null;

  return {
    ticker: ticker.toUpperCase(),
    asOf: latest.filingDate,
    totalValue: parsed.totalValue,
    holdingsCount: parsed.holdingsCount,
    holdings: parsed.holdings,
  };
}
