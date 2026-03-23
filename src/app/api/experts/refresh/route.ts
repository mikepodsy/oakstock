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
}

// ── EDGAR helpers ─────────────────────────────────────────────────────────────
const EDGAR_BASE = "https://data.sec.gov";
const EDGAR_HEADERS = {
  "User-Agent": "Oakstock research@oakstock.app",
  "Accept-Encoding": "gzip, deflate",
};
const DELAY_MS = 120; // <10 req/s

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function edgarGet(url: string): Promise<Response> {
  await sleep(DELAY_MS);
  const r = await fetch(url, { headers: EDGAR_HEADERS });
  if (!r.ok) throw new Error(`EDGAR ${r.status} for ${url}`);
  return r;
}

async function getLatestFiling(cik: string): Promise<FilingMeta | null> {
  const padded = cik.replace(/^0+/, "").padStart(10, "0");
  const url = `${EDGAR_BASE}/submissions/CIK${padded}.json`;
  const data = (await (await edgarGet(url)).json()) as Record<string, unknown>;
  const recent = (data.filings as Record<string, unknown>)?.recent as Record<string, string[]>;
  if (!recent) return null;

  const forms = recent.form ?? [];
  const accessions = recent.accessionNumber ?? [];
  const filedDates = recent.filingDate ?? [];
  const periods = recent.reportDate ?? [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "13F-HR") {
      return {
        accession: accessions[i].replace(/-/g, ""),
        filed_date: filedDates[i],
        period: periods[i],
      };
    }
  }
  return null;
}

async function getXmlUrlWithDiag(
  cik: string,
  accession: string
): Promise<{ url: string | null; indexItems: string[]; indexError?: string }> {
  const cikRaw = cik.replace(/^0+/, "");
  const accFmt = `${accession.slice(0, 10)}-${accession.slice(10, 12)}-${accession.slice(12)}`;
  const indexUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikRaw}/${accession}/${accFmt}-index.json`;

  let indexItems: string[] = [];
  let indexError: string | undefined;

  try {
    const index = (await (await edgarGet(indexUrl)).json()) as {
      directory?: { item?: { name: string; type: string }[] };
    };
    const items = index.directory?.item ?? [];
    indexItems = items.map((i) => i.name);

    // Pass 1: explicit infotable file
    for (const item of items) {
      const n = item.name.toLowerCase();
      if (n.endsWith(".xml") && (n.includes("infotable") || n.includes("informationtable") || n.includes("13finfo"))) {
        return { url: `${EDGAR_BASE}/Archives/edgar/data/${cikRaw}/${accession}/${item.name}`, indexItems };
      }
    }
    // Pass 2: any XML that isn't clearly a cover sheet
    const coverNames = new Set(["primary_doc.xml", "primarydocument.xml", "form.xml"]);
    for (const item of items) {
      if (item.name.endsWith(".xml") && !coverNames.has(item.name.toLowerCase())) {
        return { url: `${EDGAR_BASE}/Archives/edgar/data/${cikRaw}/${accession}/${item.name}`, indexItems };
      }
    }
    // Pass 3: any XML at all (maybe holdings are in the primary doc)
    for (const item of items) {
      if (item.name.endsWith(".xml")) {
        return { url: `${EDGAR_BASE}/Archives/edgar/data/${cikRaw}/${accession}/${item.name}`, indexItems };
      }
    }
  } catch (e) {
    indexError = String(e);
  }
  return { url: null, indexItems, indexError };
}

function parse13fXml(xmlText: string): HoldingRow[] {
  // Strip namespaces for simpler regex parsing (avoid DOMParser in edge runtime)
  const clean = xmlText
    .replace(/ xmlns[^"]*"[^"]*"/g, "")
    .replace(/<\?xml[^?]*\?>/g, "");

  const holdings: HoldingRow[] = [];
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
      cusip: extract("cusip"),
      company_name: extract("nameOfIssuer"),
      value_usd: parseInt(valueRaw || "0", 10) * 1000,
      shares: parseInt(sharesRaw || "0", 10),
      share_class: extract("sshPrnamtType"),
      option_type: putCall || null,
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
// Fetches latest 13F from EDGAR for a single manager and upserts to Supabase.
// Call without ?manager to refresh all (slower — Vercel Pro timeout needed).
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const managerId = request.nextUrl.searchParams.get("manager");

  // Fetch manager(s)
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
      const { url: xmlUrl, indexItems, indexError } = await getXmlUrlWithDiag(cik, filing.accession);
      if (!xmlUrl) {
        results[mid] = {
          error: "XML file not found in filing",
          accession: filing.accession,
          indexItems,
          indexError,
        };
        continue;
      }

      const xmlText = await (await edgarGet(xmlUrl)).text();
      const holdings = parse13fXml(xmlText);

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
            h.shares > prevShares
              ? "increased"
              : h.shares < prevShares
              ? "decreased"
              : "unchanged";
        }

        return {
          manager_id: mid,
          quarter,
          period_of_report: filing.period,
          filed_date: filing.filed_date,
          cusip: h.cusip || null,
          ticker: tickerMap[h.cusip] || null,
          company_name: h.company_name,
          value_usd: h.value_usd,
          shares: h.shares,
          share_class: h.share_class || null,
          option_type: h.option_type,
          change_type,
          shares_prev: prevShares,
          pct_portfolio:
            totalValue > 0
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
        filed_date: filing.filed_date,
        holdings_count: holdings.length,
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
