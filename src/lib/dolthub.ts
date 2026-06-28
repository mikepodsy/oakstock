// Read-only client for the public DoltHub `post-no-preference/options` dataset,
// which carries a daily `volatility_history` table (per-symbol IV/HV with 52-week
// high/low) going back years and current to ~yesterday. We use it to backfill
// the IV/HV history that Questrade can't provide.
import type { VolHistoryPoint } from "@/types/volatility";

const DOLT_BASE =
  "https://www.dolthub.com/api/v1alpha1/post-no-preference/options/master";

const REQUEST_TIMEOUT_MS = 15_000;

interface DoltResponse<T> {
  query_execution_status: string;
  query_execution_message: string;
  rows: T[];
}

export async function queryDoltHub<T = Record<string, string>>(
  sql: string,
): Promise<T[]> {
  const url = `${DOLT_BASE}?q=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`DoltHub query failed (${res.status})`);
  }
  const data = (await res.json()) as DoltResponse<T>;
  // "RowLimit" means the result was truncated to the API's 1000-row cap — still
  // usable data, not an error. Anything else non-Success is a real failure.
  if (data.query_execution_status !== "Success" && data.query_execution_status !== "RowLimit") {
    throw new Error(`DoltHub query error: ${data.query_execution_message}`);
  }
  return data.rows;
}

// DoltHub caps any response at 1000 rows; stay under it when backfilling.
const MAX_ROWS = 1000;

interface VolRow {
  date: string;
  iv_current: string | null;
  hv_current: string | null;
}

interface LatestRow {
  iv_year_high: string | null;
  iv_year_low: string | null;
  iv_year_high_date: string | null;
  iv_year_low_date: string | null;
}

const num = (v: string | null): number | null => (v == null ? null : Number(v));

// Fetch the IV/HV history series for a ticker since `sinceDate` (exclusive).
// Returns ascending by date.
export async function fetchDoltVolHistory(
  ticker: string,
  sinceDate?: string,
): Promise<VolHistoryPoint[]> {
  const sym = ticker.toUpperCase().replace(/'/g, "");
  // Incremental top-up (small) sorts ascending; first-time backfill grabs the
  // most recent MAX_ROWS rows (DESC + LIMIT) to dodge the 1000-row cap, then we
  // re-sort ascending below.
  const sql = sinceDate
    ? `SELECT date, iv_current, hv_current FROM volatility_history ` +
      `WHERE act_symbol = '${sym}' AND date > '${sinceDate}' ORDER BY date ASC`
    : `SELECT date, iv_current, hv_current FROM volatility_history ` +
      `WHERE act_symbol = '${sym}' ORDER BY date DESC LIMIT ${MAX_ROWS}`;
  const rows = await queryDoltHub<VolRow>(sql);
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows.map((r) => {
    const iv = num(r.iv_current);
    const hv = num(r.hv_current);
    return {
      date: r.date,
      iv,
      hv,
      vrp: iv != null && hv != null ? iv - hv : null,
    };
  });
}

// The dataset's own 52-week IV high/low for the ticker (latest row).
export async function fetchDoltIvYearRange(
  ticker: string,
): Promise<{ high: number | null; low: number | null }> {
  const sym = ticker.toUpperCase().replace(/'/g, "");
  const rows = await queryDoltHub<LatestRow>(
    `SELECT iv_year_high, iv_year_low FROM volatility_history ` +
      `WHERE act_symbol = '${sym}' ORDER BY date DESC LIMIT 1`,
  );
  const r = rows[0];
  return { high: num(r?.iv_year_high ?? null), low: num(r?.iv_year_low ?? null) };
}
