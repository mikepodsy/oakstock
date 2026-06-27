import { createServerSupabaseClient } from "@/lib/supabase";
import type { FinancialStatement, FundamentalsData } from "@/types";

export type Source = "edgar" | "yahoo" | "none";

// Re-fetch from the upstream source once persisted data is older than this.
const MAX_AGE_DAYS = 7;

// Column ↔ FinancialStatement field mapping for the wide company_financials
// table. Keys are DB columns; values are FinancialStatement keys.
const COLUMN_TO_FIELD = {
  revenue: "revenue",
  ebitda: "ebitda",
  free_cash_flow: "freeCashFlow",
  operating_cash_flow: "operatingCashFlow",
  capex: "capex",
  net_income: "netIncome",
  gross_profit: "grossProfit",
  operating_income: "operatingIncome",
  cost_of_revenue: "costOfRevenue",
  eps: "eps",
  eps_basic: "epsBasic",
  buybacks: "buybacks",
  dividends_paid: "dividendsPaid",
  total_debt: "totalDebt",
  stockholders_equity: "stockholdersEquity",
} as const satisfies Record<string, keyof FinancialStatement>;

type DbRow = Record<string, unknown> & {
  period_type: string;
  period_end: string;
};

function rowToStatement(row: DbRow): FinancialStatement {
  const s = {
    date: new Date(`${row.period_end}T00:00:00Z`).toISOString(),
  } as FinancialStatement;
  for (const [col, field] of Object.entries(COLUMN_TO_FIELD)) {
    const v = row[col];
    (s[field] as number | null) = v == null ? null : Number(v);
  }
  return s;
}

function statementToRow(
  ticker: string,
  cik: string | null,
  source: Source,
  periodType: "annual" | "quarterly",
  s: FinancialStatement,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    ticker,
    cik,
    source,
    period_type: periodType,
    period_end: s.date.slice(0, 10),
  };
  for (const [col, field] of Object.entries(COLUMN_TO_FIELD)) {
    row[col] = s[field];
  }
  return row;
}

export type FreshResult =
  | { status: "fresh"; data: FundamentalsData | null }
  | { status: "stale" };

// Return persisted fundamentals when they exist and are recent enough.
// `{ status: "fresh", data: null }` means we recently tried and the ticker has
// no data anywhere (don't re-fetch). `{ status: "stale" }` means go fetch.
export async function readFreshFundamentals(
  ticker: string,
): Promise<FreshResult> {
  const supabase = createServerSupabaseClient();

  const { data: sync } = await supabase
    .from("company_financials_sync")
    .select("source, fetched_at")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!sync) return { status: "stale" };

  const ageMs = Date.now() - new Date(sync.fetched_at as string).getTime();
  if (ageMs > MAX_AGE_DAYS * 86_400_000) return { status: "stale" };

  if (sync.source === "none") return { status: "fresh", data: null };

  const { data: rows } = await supabase
    .from("company_financials")
    .select("*")
    .eq("ticker", ticker)
    .order("period_end", { ascending: true });

  if (!rows || rows.length === 0) return { status: "fresh", data: null };

  const quarterly: FinancialStatement[] = [];
  const annual: FinancialStatement[] = [];
  for (const row of rows as DbRow[]) {
    (row.period_type === "annual" ? annual : quarterly).push(
      rowToStatement(row),
    );
  }
  return { status: "fresh", data: { ticker, quarterly, annual } };
}

// Persist a freshly fetched dataset (replacing existing rows for the ticker) and
// record the sync timestamp. Failures are swallowed — persistence is a cache, so
// a write error must never break the request.
export async function persistFundamentals(
  cik: string | null,
  source: Source,
  data: FundamentalsData,
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    const ticker = data.ticker;
    const rows = [
      ...data.annual.map((s) => statementToRow(ticker, cik, source, "annual", s)),
      ...data.quarterly.map((s) =>
        statementToRow(ticker, cik, source, "quarterly", s),
      ),
    ];

    await supabase.from("company_financials").delete().eq("ticker", ticker);
    if (rows.length > 0) {
      await supabase.from("company_financials").insert(rows);
    }
    await markSync(ticker, cik, source);
  } catch {
    // best-effort cache write
  }
}

// Record that we attempted a fetch (used for the "no data anywhere" case so we
// don't re-hit upstreams on every page load).
export async function markSync(
  ticker: string,
  cik: string | null,
  source: Source,
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    await supabase
      .from("company_financials_sync")
      .upsert(
        { ticker, cik, source, fetched_at: new Date().toISOString() },
        { onConflict: "ticker" },
      );
  } catch {
    // best-effort
  }
}
