// Supabase persistence for the IV/HV history series (table: iv_history).
//
// Best-effort by design: if the table is missing or a write fails, callers fall
// back to querying DoltHub live. Mirrors the edgar store's "cache, don't block"
// philosophy. One row per (ticker, date); vols stored as fractions.
import { createServerSupabaseClient } from "@/lib/supabase";
import type { VolHistoryPoint } from "@/types/volatility";

interface IvRow {
  date: string;
  iv30: number | null;
  hv30: number | null;
}

// Read the full stored series for a ticker (ascending). Returns [] on any error
// (including a missing table), signalling the caller to backfill from DoltHub.
export async function readIvHistory(ticker: string): Promise<VolHistoryPoint[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("iv_history")
      .select("date, iv30, hv30")
      .eq("ticker", ticker.toUpperCase())
      .order("date", { ascending: true });
    if (error || !data) return [];
    return (data as IvRow[]).map((r) => {
      const iv = r.iv30;
      const hv = r.hv30;
      return {
        date: r.date,
        iv,
        hv,
        vrp: iv != null && hv != null ? iv - hv : null,
      };
    });
  } catch {
    return [];
  }
}

// The most recent stored date for a ticker, or null. Used to fetch only the
// DoltHub rows we don't already have.
export async function latestStoredDate(ticker: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("iv_history")
      .select("date")
      .eq("ticker", ticker.toUpperCase())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { date: string }).date;
  } catch {
    return null;
  }
}

// Upsert a batch of history rows (iv30/hv30). Best-effort: failures are swallowed.
export async function upsertIvHistory(
  ticker: string,
  rows: VolHistoryPoint[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const supabase = createServerSupabaseClient();
    const payload = rows.map((r) => ({
      ticker: ticker.toUpperCase(),
      date: r.date,
      iv30: r.iv,
      hv30: r.hv,
    }));
    await supabase.from("iv_history").upsert(payload, { onConflict: "ticker,date" });
  } catch {
    /* best-effort cache */
  }
}

// Attach today's snapshot (rank/percentile + term structure + skew) to the
// latest row. Best-effort.
export async function upsertSnapshot(
  ticker: string,
  date: string,
  snapshot: {
    ivRank: number | null;
    ivPercentile: number | null;
    termStructure: unknown;
    skew: unknown;
  },
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    await supabase
      .from("iv_history")
      .update({
        iv_rank: snapshot.ivRank,
        iv_percentile: snapshot.ivPercentile,
        term_structure: snapshot.termStructure,
        skew: snapshot.skew,
        updated_at: new Date().toISOString(),
      })
      .eq("ticker", ticker.toUpperCase())
      .eq("date", date);
  } catch {
    /* best-effort */
  }
}
