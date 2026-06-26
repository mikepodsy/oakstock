import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { createServerSupabaseClient } from "@/lib/supabase";
import { TTLCache } from "@/lib/cache";

const yf = new YahooFinance();

// Long-lived per-manager cache for the (expensive) reconstructed series.
const g = globalThis as Record<string, unknown>;
const perfCache: TTLCache<PerformanceResponse> =
  (g.__cache_expert_perf as TTLCache<PerformanceResponse>) ??
  (g.__cache_expert_perf = new TTLCache<PerformanceResponse>(3600));

const SP500 = "SPY";
const NASDAQ = "QQQ";
const TOP_N = 20;            // holdings used for the reconstructed portfolio
const WEEKS_PER_YEAR = 52;
const RISK_FREE = 0.045;

interface SeriesPoint { date: string; fund: number; sp500: number | null; nasdaq: number | null; }
interface QuarterReturn { quarter: string; return: number; }
interface PerformanceResponse {
  mode: "vehicle" | "reconstructed";
  ticker: string | null;
  holdings_used: number;
  series: SeriesPoint[];
  sharpe: number | null;
  quarterly: QuarterReturn[];
}

// Weekly close series since 2000 → Map<dateISO, close>, plus ordered dates.
async function weeklyCloses(ticker: string): Promise<Map<string, number>> {
  try {
    const result = await yf.chart(ticker, {
      period1: new Date("2000-01-01"),
      interval: "1wk",
    });
    const map = new Map<string, number>();
    for (const q of result.quotes) {
      // Adjusted close (splits/dividends) is required for a correct return series.
      const close = q.adjclose ?? q.close;
      if (close != null) map.set(q.date.toISOString().split("T")[0], close);
    }
    return map;
  } catch {
    return new Map();
  }
}

// Annualized Sharpe from a weekly index series.
function weeklySharpe(values: number[]): number | null {
  if (values.length < 10) return null;
  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) rets.push(values[i] / values[i - 1] - 1);
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  const rfWeekly = RISK_FREE / WEEKS_PER_YEAR;
  return ((mean - rfWeekly) / sd) * Math.sqrt(WEEKS_PER_YEAR);
}

// Calendar-quarter returns for the last ~12 quarters from a weekly index series.
function quarterlyReturns(series: { date: string; fund: number }[]): QuarterReturn[] {
  const byQ = new Map<string, { first: number; last: number }>();
  for (const p of series) {
    const d = new Date(p.date);
    const key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    const e = byQ.get(key);
    if (!e) byQ.set(key, { first: p.fund, last: p.fund });
    else e.last = p.fund;
  }
  const out: QuarterReturn[] = [];
  for (const [quarter, { first, last }] of byQ) {
    if (first > 0) out.push({ quarter, return: last / first - 1 });
  }
  return out.slice(-12);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ manager: string }> }
) {
  const { manager: managerId } = await params;
  const noCache = _req.nextUrl.searchParams.get("nocache") === "1";

  const cached = noCache ? undefined : perfCache.get(managerId);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  const supabase = createServerSupabaseClient();
  const { data: manager } = await supabase
    .from("expert_managers")
    .select("id, public_ticker")
    .eq("id", managerId)
    .maybeSingle();

  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  const [spx, ndx] = await Promise.all([weeklyCloses(SP500), weeklyCloses(NASDAQ)]);

  let fundDates: string[] = [];
  let fundValues: number[] = [];
  let mode: "vehicle" | "reconstructed";
  const ticker: string | null = manager.public_ticker ?? null;
  let holdingsUsed = 0;

  if (manager.public_ticker) {
    // ── Listed vehicle: use the real stock's weekly closes ──
    mode = "vehicle";
    const closes = await weeklyCloses(manager.public_ticker);
    fundDates = [...closes.keys()].sort();
    fundValues = fundDates.map((d) => closes.get(d)!);
  } else {
    // ── Reconstructed: weighted index from the latest-quarter top holdings ──
    mode = "reconstructed";
    const { data: latest } = await supabase
      .from("expert_holdings")
      .select("quarter, period_of_report")
      .eq("manager_id", managerId)
      .order("period_of_report", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      const { data: rows } = await supabase
        .from("expert_holdings")
        .select("ticker, pct_portfolio")
        .eq("manager_id", managerId)
        .eq("quarter", latest.quarter)
        .is("option_type", null)
        .not("ticker", "is", null)
        .order("pct_portfolio", { ascending: false })
        .limit(TOP_N);

      const picks = (rows ?? []).filter((r) => r.ticker && r.pct_portfolio > 0);
      const totalW = picks.reduce((s, r) => s + Number(r.pct_portfolio), 0);

      if (picks.length && totalW > 0) {
        const weights = picks.map((r) => ({
          ticker: r.ticker as string,
          w: Number(r.pct_portfolio) / totalW,
        }));
        const maps = await Promise.all(weights.map((p) => weeklyCloses(p.ticker)));
        const series = weights.map((p, i) => ({ w: p.w, closes: maps[i] }));
        holdingsUsed = series.filter((s) => s.closes.size > 0).length;

        // Build the weighted total-return index along the SPY weekly timeline.
        // Cap reconstructed history to ~10y: extending current weights further back
        // is meaningless (look-ahead) and dominated by single-stock artifacts.
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 10);
        const cutoffISO = cutoff.toISOString().split("T")[0];
        const timeline = [...spx.keys()].sort().filter((d) => d >= cutoffISO);
        let index = 100;
        let started = false;
        for (let i = 0; i < timeline.length; i++) {
          const d = timeline[i];
          const prevD = timeline[i - 1];
          if (!started) {
            // Start once at least one holding has data on this date.
            if (series.some((s) => s.closes.has(d))) {
              started = true;
              fundDates.push(d);
              fundValues.push(index);
            }
            continue;
          }
          let wsum = 0;
          let wret = 0;
          for (const s of series) {
            const c0 = s.closes.get(prevD);
            const c1 = s.closes.get(d);
            if (c0 != null && c1 != null && c0 > 0) {
              wret += s.w * (c1 / c0 - 1);
              wsum += s.w;
            }
          }
          if (wsum > 0) index *= 1 + wret / wsum;
          fundDates.push(d);
          fundValues.push(index);
        }
      }
    }
  }

  const series: SeriesPoint[] = fundDates.map((d, i) => ({
    date: d,
    fund: fundValues[i],
    sp500: spx.get(d) ?? null,
    nasdaq: ndx.get(d) ?? null,
  }));

  const response: PerformanceResponse = {
    mode,
    ticker,
    holdings_used: holdingsUsed,
    series,
    sharpe: weeklySharpe(fundValues),
    quarterly: quarterlyReturns(series),
  };

  perfCache.set(managerId, response);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
  });
}
