import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HoldingRow {
  cusip: string;
  company_name: string;
  value_usd: number;
  shares: number;
  share_class: string;
  option_type: string | null;
}

interface FilingMeta {
  accession: string;
  filed_date: string;
  period: string;
  primaryDocument: string;
}

// ── EDGAR helpers ─────────────────────────────────────────────────────────────
const EDGAR_BASE = "https://data.sec.gov";
const WWW_EDGAR  = "https://www.sec.gov";
const EDGAR_HEADERS = {
  "User-Agent": "Oakstock research@oakstock.app",
  "Accept-Encoding": "gzip, deflate",
};
const DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function edgarGet(url: string): Promise<Response> {
  await sleep(DELAY_MS);
  const r = await fetch(url, { headers: EDGAR_HEADERS });
  if (!r.ok) throw new Error(`EDGAR ${r.status} for ${url}`);
  return r;
}

async function edgarTry(url: string): Promise<Response | null> {
  await sleep(DELAY_MS);
  try {
    const r = await fetch(url, { headers: EDGAR_HEADERS });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

async function getLatestFiling(cik: string): Promise<FilingMeta | null> {
  const padded = cik.replace(/^0+/, "").padStart(10, "0");
  const url = `${EDGAR_BASE}/submissions/CIK${padded}.json`;
  const data = (await (await edgarGet(url)).json()) as Record<string, unknown>;
  const recent = (data.filings as Record<string, unknown>)?.recent as Record<string, string[]>;
  if (!recent) return null;

  const forms       = recent.form            ?? [];
  const accessions  = recent.accessionNumber ?? [];
  const filedDates  = recent.filingDate      ?? [];
  const periods     = recent.reportDate      ?? [];
  const primaryDocs = recent.primaryDocument ?? [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "13F-HR") {
      return {
        accession:       accessions[i].replace(/-/g, ""),
        filed_date:      filedDates[i],
        period:          periods[i],
        primaryDocument: primaryDocs[i] ?? "",
      };
    }
  }
  return null;
}

// Build a prioritised list of candidate XML filenames for the infotable.
// Strategy:
//   1. Derive from the primaryDocument name (most reliable)
//   2. Try well-known convention names used by major filing agents
//   3. Parse the filing index HTML as last resort
function candidateInfoTableNames(primaryDocument: string): string[] {
  const candidates: string[] = [];
  const base = primaryDocument.replace(/\.[^.]+$/, ""); // strip extension

  // Donnelley / Edgar Online pattern: d{n}form13fhr → d{n}form13fInfoTable
  if (base) {
    candidates.push(
      `${base.replace(/hr$/i, "")}InfoTable.xml`,
      `${base.replace(/hr$/i, "")}infotable.xml`,
      `${base}InfoTable.xml`,
    );
  }

  // Common generic names
  candidates.push(
    "form13fInfoTable.xml",
    "form13finfotable.xml",
    "informationTable.xml",
    "informationtable.xml",
    "infotable.xml",
    "13F_InfoTable.xml",
    "13f-infotable.xml",
  );

  // Deduplicate while preserving order
  return [...new Set(candidates.filter(Boolean))];
}

async function getXmlUrlWithDiag(
  cik: string,
  accession: string,
  primaryDocument: string,
): Promise<{ url: string | null; tried: string[]; indexError?: string }> {
  const cikRaw = cik.replace(/^0+/, "");
  const accFmt = `${accession.slice(0, 10)}-${accession.slice(10, 12)}-${accession.slice(12)}`;
  const archiveBase = `${EDGAR_BASE}/Archives/edgar/data/${cikRaw}/${accession}`;
  const tried: string[] = [];
  let indexError: string | undefined;

  // ── Approach 1: filing index JSON (data.sec.gov) ──────────────────────────
  const indexJsonUrl = `${archiveBase}/${accFmt}-index.json`;
  tried.push(indexJsonUrl);
  try {
    const index = (await (await edgarGet(indexJsonUrl)).json()) as {
      directory?: { item?: { name: string; type: string }[] };
    };
    const items = index.directory?.item ?? [];
    const xmlNames = items.map((i) => i.name).filter((n) => n.endsWith(".xml"));

    for (const name of xmlNames) {
      const n = name.toLowerCase();
      if (n.includes("infotable") || n.includes("informationtable") || n.includes("13finfo")) {
        return { url: `${archiveBase}/${name}`, tried };
      }
    }
    // Any non-cover XML
    const cover = new Set(["primary_doc.xml", "primarydocument.xml", "form.xml"]);
    for (const name of xmlNames) {
      if (!cover.has(name.toLowerCase())) {
        return { url: `${archiveBase}/${name}`, tried };
      }
    }
    if (xmlNames.length > 0) {
      return { url: `${archiveBase}/${xmlNames[0]}`, tried };
    }
  } catch (e) {
    indexError = String(e);
  }

  // ── Approach 2: filing index JSON (www.sec.gov mirror) ───────────────────
  const wwwIndexUrl = `${WWW_EDGAR}/Archives/edgar/data/${cikRaw}/${accession}/${accFmt}-index.json`;
  tried.push(wwwIndexUrl);
  try {
    const index = (await (await edgarGet(wwwIndexUrl)).json()) as {
      directory?: { item?: { name: string; type: string }[] };
    };
    const items = index.directory?.item ?? [];
    for (const item of items) {
      const n = item.name.toLowerCase();
      if (n.endsWith(".xml") && (n.includes("infotable") || n.includes("informationtable"))) {
        return { url: `${archiveBase}/${item.name}`, tried };
      }
    }
  } catch {
    // ignore
  }

  // ── Approach 3: probe candidate filenames directly ────────────────────────
  const candidates = candidateInfoTableNames(primaryDocument);
  for (const filename of candidates) {
    const testUrl = `${archiveBase}/${filename}`;
    tried.push(testUrl);
    const r = await edgarTry(testUrl);
    if (r) return { url: testUrl, tried };
  }

  // ── Approach 4: fetch & parse the index HTM ───────────────────────────────
  const indexHtmUrl = `${WWW_EDGAR}/Archives/edgar/data/${cikRaw}/${accession}/${accFmt}-index.htm`;
  tried.push(indexHtmUrl);
  try {
    const htm = await (await edgarGet(indexHtmUrl)).text();
    // Extract href links to XML files from the HTML
    const hrefRe = /href="([^"]+\.xml)"/gi;
    let m: RegExpExecArray | null;
    const xmlLinks: string[] = [];
    while ((m = hrefRe.exec(htm)) !== null) {
      xmlLinks.push(m[1]);
    }
    for (const link of xmlLinks) {
      const filename = link.split("/").pop() ?? link;
      const n = filename.toLowerCase();
      if (n.includes("infotable") || n.includes("informationtable") || n.includes("13finfo")) {
        const fullUrl = link.startsWith("http") ? link : `${archiveBase}/${filename}`;
        return { url: fullUrl, tried };
      }
    }
    // Any XML link that isn't the cover
    const cover = new Set(["primary_doc.xml", "primarydocument.xml"]);
    for (const link of xmlLinks) {
      const filename = link.split("/").pop() ?? link;
      if (!cover.has(filename.toLowerCase())) {
        const fullUrl = link.startsWith("http") ? link : `${archiveBase}/${filename}`;
        return { url: fullUrl, tried };
      }
    }
  } catch {
    // ignore
  }

  return { url: null, tried, indexError };
}

function parse13fXml(xmlText: string): HoldingRow[] {
  // Strip namespaces for simpler regex parsing (avoid DOMParser in edge runtime)
  const clean = xmlText
    .replace(/ xmlns[^"]*"[^"]*"/g, "")
    .replace(/<\?xml[^?]*\?>/g, "");

  const holdings: HoldingRow[] = [];

  // Try <infoTable> blocks first, then <informationTable> wrapper
  const tableRe = /<infoTable>([\s\S]*?)<\/infoTable>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRe.exec(clean)) !== null) {
    const block = tableMatch[1];

    function extract(tag: string): string {
      const m = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i").exec(block);
      return m ? m[1].trim() : "";
    }

    const valueRaw = extract("value").replace(/,/g, "");
    const sharesRaw = extract("sshPrnamt").replace(/,/g, "");
    const putCall = extract("putCall");

    holdings.push({
      cusip:        extract("cusip"),
      company_name: extract("nameOfIssuer"),
      value_usd:    parseInt(valueRaw || "0", 10) * 1000,
      shares:       parseInt(sharesRaw || "0", 10),
      share_class:  extract("sshPrnamtType"),
      option_type:  putCall || null,
    });
  }

  return holdings;
}

// ── CUSIP → ticker via OpenFIGI ───────────────────────────────────────────────
async function resolveTickersOpenFigi(
  cusips: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const batchSize = 100;

  for (let i = 0; i < cusips.length; i += batchSize) {
    const batch = cusips.slice(i, i + batchSize);
    const payload = batch.map((c) => ({ idType: "ID_CUSIP", idValue: c }));

    try {
      await sleep(600);
      const r = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const results = (await r.json()) as Array<{
          data?: Array<{ ticker?: string; exchCode?: string }>;
        }>;
        results.forEach((result, idx) => {
          const cusip = batch[idx];
          if (result.data?.length) {
            const preferred = result.data.find((d) =>
              ["US", "UQ", "UN", "UA"].includes(d.exchCode ?? "")
            );
            map[cusip] = (preferred ?? result.data[0]).ticker ?? "";
          }
        });
      }
    } catch {
      // OpenFIGI failures are non-critical — tickers just stay null
    }
  }

  return map;
}

// ── Quarter label ─────────────────────────────────────────────────────────────
function periodToQuarter(period: string): string {
  const d = new Date(period);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

// ── POST /api/experts/refresh?manager=buffett ─────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const managerId = request.nextUrl.searchParams.get("manager");

  let query = supabase.from("expert_managers").select("*");
  if (managerId) query = query.eq("id", managerId) as typeof query;
  const { data: managers, error: mgErr } = await query;

  if (mgErr) return NextResponse.json({ error: mgErr.message }, { status: 500 });
  if (!managers?.length) return NextResponse.json({ error: "No managers found" }, { status: 404 });

  const results: Record<string, unknown> = {};

  for (const manager of managers) {
    const mid = manager.id as string;
    const cik = manager.cik as string;

    try {
      // 1. Get latest 13F filing metadata
      const filing = await getLatestFiling(cik);
      if (!filing) {
        results[mid] = { error: "No 13F filing found" };
        continue;
      }

      const quarter = periodToQuarter(filing.period);

      // 2. Check if already cached
      const { data: existing } = await supabase
        .from("expert_holdings")
        .select("id")
        .eq("manager_id", mid)
        .eq("quarter", quarter)
        .limit(1)
        .maybeSingle();

      if (existing) {
        results[mid] = { status: "already_cached", quarter };
        continue;
      }

      // 3. Find + fetch XML
      const { url: xmlUrl, tried, indexError } = await getXmlUrlWithDiag(
        cik, filing.accession, filing.primaryDocument
      );
      if (!xmlUrl) {
        results[mid] = {
          error: "XML file not found in filing",
          accession: filing.accession,
          primaryDocument: filing.primaryDocument,
          tried,
          indexError,
        };
        continue;
      }

      const xmlText = await (await edgarGet(xmlUrl)).text();
      const holdings = parse13fXml(xmlText);

      if (holdings.length === 0) {
        results[mid] = { error: "Parsed 0 holdings from XML", xmlUrl, tried };
        continue;
      }

      // 4. Get previous quarter for change tracking
      const { data: prevRows } = await supabase
        .from("expert_holdings")
        .select("cusip, shares, option_type")
        .eq("manager_id", mid)
        .order("period_of_report", { ascending: false })
        .limit(500);

      const prevMap = new Map<string, number>();
      for (const r of prevRows ?? []) {
        prevMap.set(`${r.cusip}__${r.option_type ?? ""}`, r.shares);
      }

      // 5. Resolve CUSIPs → tickers
      const cusips = [...new Set(holdings.map((h) => h.cusip).filter(Boolean))];
      const tickerMap = await resolveTickersOpenFigi(cusips);

      // 6. Build rows
      const totalValue = holdings.reduce((s, h) => s + h.value_usd, 0);
      const rows = holdings.map((h) => {
        const key = `${h.cusip}__${h.option_type ?? ""}`;
        const prevShares = prevMap.get(key) ?? null;
        let change_type = "new";
        if (prevShares !== null) {
          change_type =
            h.shares > prevShares ? "increased" :
            h.shares < prevShares ? "decreased" : "unchanged";
        }

        return {
          manager_id:      mid,
          quarter,
          period_of_report: filing.period,
          filed_date:       filing.filed_date,
          cusip:            h.cusip || null,
          ticker:           tickerMap[h.cusip] || null,
          company_name:     h.company_name,
          value_usd:        h.value_usd,
          shares:           h.shares,
          share_class:      h.share_class || null,
          option_type:      h.option_type,
          change_type,
          shares_prev:      prevShares,
          pct_portfolio:    totalValue > 0
            ? Math.round((h.value_usd / totalValue) * 100000) / 1000
            : 0,
        };
      });

      // 7. Upsert in batches
      for (let i = 0; i < rows.length; i += 500) {
        await supabase
          .from("expert_holdings")
          .upsert(rows.slice(i, i + 500), {
            onConflict: "manager_id,quarter,cusip,option_type",
          });
      }

      // 8. Touch updated_at
      await supabase
        .from("expert_managers")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", mid);

      results[mid] = {
        status: "fetched",
        quarter,
        filed_date:       filing.filed_date,
        primaryDocument:  filing.primaryDocument,
        xmlUrl,
        holdings_count:   holdings.length,
        tickers_resolved: Object.keys(tickerMap).length,
      };
    } catch (err) {
      results[mid] = { error: String(err) };
    }
  }

  return NextResponse.json({ results });
}

// GET version for easy browser / cron triggering
export async function GET(request: NextRequest) {
  return POST(request);
}
