import YahooFinance from "yahoo-finance2";
import { createServerSupabaseClient } from "@/lib/supabase";
import { fetchDailyCandlesYahoo } from "@/lib/candles";
import { evaluateMomentum } from "@/utils/momentum";

// Shared bulk momentum-refresh engine behind both the large-cap and ETF refresh
// routes. Fetches ~2y of daily candles per ticker via Yahoo, computes 50d/200d
// momentum, and upserts into the given snapshot table. Fetching hundreds of
// histories takes ~20-60s, so callers set an extended route `maxDuration`.

const yf = new YahooFinance();

// How many candle fetches to run at once. High enough to finish quickly, low
// enough to avoid Yahoo rate-limiting (429s).
const CONCURRENCY = 8;
const QUOTE_CHUNK = 50;

interface Meta {
  marketCap: number | null;
  name: string | null;
}

export interface RefreshResult {
  updated: number;
  failed: number;
  durationMs: number;
  errors: { ticker: string; detail: string }[];
}

// Batched quote lookups for market cap + name (one request per ~50 tickers).
// ETFs report AUM as `totalAssets` rather than `marketCap`; fall back to it so
// the crossings list can sort ties by fund size.
async function fetchMeta(tickers: string[]): Promise<Map<string, Meta>> {
  const meta = new Map<string, Meta>();
  for (let i = 0; i < tickers.length; i += QUOTE_CHUNK) {
    const chunk = tickers.slice(i, i + QUOTE_CHUNK);
    try {
      const quotes = await yf.quote(chunk);
      for (const q of quotes) {
        meta.set(q.symbol, {
          marketCap: q.marketCap ?? q.totalAssets ?? null,
          name: q.longName ?? q.shortName ?? q.displayName ?? null,
        });
      }
    } catch {
      // A bad chunk just means those rows store null meta; not fatal.
    }
  }
  return meta;
}

// Process tickers with bounded concurrency, returning each settled outcome.
async function mapPool<T>(
  items: string[],
  worker: (item: string) => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await worker(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

/**
 * Recompute momentum for `tickers` and upsert into `table` (keyed on `ticker`).
 * Returns per-run counters; a per-ticker failure is recorded and skipped rather
 * than aborting the batch. Throws only if a Supabase upsert itself fails.
 */
export async function refreshMomentum(
  tickers: readonly string[],
  table: string
): Promise<RefreshResult> {
  const started = Date.now();
  const unique = Array.from(new Set(tickers));

  const meta = await fetchMeta(unique);
  const supabase = createServerSupabaseClient();

  let updated = 0;
  let failed = 0;
  const errors: { ticker: string; detail: string }[] = [];

  const settled = await mapPool(unique, async (ticker) => {
    const candles = await fetchDailyCandlesYahoo(ticker);
    if (!candles) throw new Error("no candle data");
    const m = evaluateMomentum(ticker, candles);
    const info = meta.get(ticker);
    return {
      ticker,
      name: info?.name ?? null,
      market_cap: info?.marketCap ?? null,
      close: m.close,
      sma50: m.sma50,
      sma200: m.sma200,
      distance50_pct: m.distance50Pct,
      distance200_pct: m.distance200Pct,
      price_vs50: m.priceVs50,
      price_vs200: m.priceVs200,
      cross50v200: m.cross50v200,
      updated_at: new Date().toISOString(),
    };
  });

  const rows = settled
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      failed++;
      const detail = r.reason instanceof Error ? r.reason.message : "unknown error";
      errors.push({ ticker: unique[i], detail });
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Upsert in batches to stay well under payload limits.
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "ticker" });
    if (error) {
      throw new Error(`upsert into ${table} failed: ${error.message}`);
    }
    updated += batch.length;
  }

  return { updated, failed, durationMs: Date.now() - started, errors };
}
