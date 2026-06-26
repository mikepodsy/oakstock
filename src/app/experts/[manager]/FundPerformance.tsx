"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { getPeriodStartDate } from "@/lib/history-utils";
import { TimeRangePicker } from "@/components/charts/TimeRangePicker";

interface SeriesPoint { date: string; fund: number; sp500: number | null; nasdaq: number | null; }
interface QuarterReturn { quarter: string; return: number; }
interface PerformanceData {
  mode: "vehicle" | "reconstructed";
  ticker: string | null;
  holdings_used: number;
  series: SeriesPoint[];
  sharpe: number | null;
  quarterly: QuarterReturn[];
}

const RANGES = [
  { label: "3M", value: "3m" },
  { label: "YTD", value: "ytd" },
  { label: "1Y", value: "1y" },
  { label: "3Y", value: "3y" },
  { label: "5Y", value: "5y" },
  { label: "Max", value: "max" },
] as const;

const NASDAQ_COLOR = "#60a5fa"; // blue-400

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

interface ChartPoint { date: string; fund: number | null; sp500: number | null; nasdaq: number | null; }

function Tip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; dataKey: string }>;
}) {
  if (!active || !payload?.length || !label) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? null;
  const rows = [
    { name: "Fund", v: get("fund"), c: "var(--green-primary)" },
    { name: "S&P 500", v: get("sp500"), c: "var(--oak-300)" },
    { name: "Nasdaq 100", v: get("nasdaq"), c: NASDAQ_COLOR },
  ];
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 shadow-xl">
      <p className="text-text-tertiary text-xs mb-1">{format(new Date(label), "MMM d, yyyy")}</p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.c }} />
            <span className="text-text-secondary">{r.name}</span>
          </span>
          <span className={`tabular-nums ${r.v != null && r.v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {pct(r.v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FundPerformance({ managerId }: { managerId: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<string>("1y");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/experts/${managerId}/performance`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) { setError(true); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [managerId]);

  // Slice to the selected window and re-base each line to % change from the window start.
  const { chart, returns } = useMemo(() => {
    const empty = { chart: [] as ChartPoint[], returns: { fund: null as number | null, sp500: null as number | null, nasdaq: null as number | null } };
    if (!data?.series?.length) return empty;
    const cutoff = getPeriodStartDate(period).toISOString().split("T")[0];
    const slice = data.series.filter((p) => p.date >= cutoff);
    const pts = slice.length >= 2 ? slice : data.series;
    const base = pts[0];
    const bFund = base.fund;
    const bSp = base.sp500;
    const bNd = base.nasdaq;
    const chart: ChartPoint[] = pts.map((p) => ({
      date: p.date,
      fund: bFund ? (p.fund / bFund - 1) * 100 : null,
      sp500: bSp && p.sp500 != null ? (p.sp500 / bSp - 1) * 100 : null,
      nasdaq: bNd && p.nasdaq != null ? (p.nasdaq / bNd - 1) * 100 : null,
    }));
    const last = chart[chart.length - 1];
    return { chart, returns: { fund: last.fund, sp500: last.sp500, nasdaq: last.nasdaq } };
  }, [data, period]);

  const quarterly = data?.quarterly ?? [];
  const maxQ = Math.max(0.001, ...quarterly.map((q) => Math.abs(q.return)));

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-text-primary font-semibold text-sm">Fund Performance</h3>
          <p className="text-text-tertiary text-xs mt-0.5">
            {loading || !data
              ? " "
              : data.mode === "vehicle"
              ? `Listed vehicle: ${data.ticker} · vs S&P 500 & Nasdaq 100`
              : `Hypothetical — latest 13F top ${data.holdings_used} holdings, not actual fund returns`}
          </p>
        </div>
        <TimeRangePicker selected={period} onSelect={setPeriod} ranges={RANGES} />
      </div>

      {loading ? (
        <div className="h-[300px] w-full rounded-lg bg-bg-tertiary animate-pulse" />
      ) : error || !data || chart.length < 2 ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-text-tertiary text-sm gap-1">
          <p>Performance unavailable</p>
          <p className="text-xs">No priceable holdings for this fund.</p>
        </div>
      ) : (
        <>
          {/* Stat row */}
          <div className="flex items-center gap-5 mb-4 flex-wrap">
            <div>
              <p className="text-text-tertiary text-xs">Return ({RANGES.find((r) => r.value === period)?.label})</p>
              <p className={`text-lg font-bold tabular-nums ${returns.fund != null && returns.fund >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pct(returns.fund)}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Sharpe Ratio{data.mode === "reconstructed" ? " (10y)" : ""}</p>
              <p className="text-lg font-bold tabular-nums text-text-primary">
                {data.sharpe != null ? data.sharpe.toFixed(2) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <Legend color="var(--green-primary)" label="Fund" value={pct(returns.fund)} />
              <Legend color="var(--oak-300)" label="S&P 500" value={pct(returns.sp500)} />
              <Legend color={NASDAQ_COLOR} label="Nasdaq 100" value={pct(returns.nasdaq)} />
            </div>
          </div>

          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(d: string) => format(new Date(d), period === "3m" || period === "ytd" ? "MMM d" : "MMM ''yy")}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeDasharray="4 4" strokeWidth={1} />
                <Line type="monotone" dataKey="sp500" stroke="var(--oak-300)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="nasdaq" stroke={NASDAQ_COLOR} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="fund" stroke="var(--green-primary)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quarterly breakdown */}
          {quarterly.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border-primary">
              <p className="text-text-tertiary text-xs mb-3">Quarter-by-quarter return</p>
              <div className="flex items-end gap-2 overflow-x-auto">
                {quarterly.map((q) => {
                  const up = q.return >= 0;
                  const h = Math.round((Math.abs(q.return) / maxQ) * 36) + 2;
                  return (
                    <div key={q.quarter} className="flex flex-col items-center gap-1 shrink-0 w-12" title={`${q.quarter}: ${pct(q.return * 100)}`}>
                      <span className={`text-[10px] tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
                        {pct(q.return * 100)}
                      </span>
                      <div className="h-[40px] flex flex-col justify-end">
                        <div
                          className={`w-5 rounded-sm ${up ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                          style={{ height: `${h}px` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-tertiary whitespace-nowrap">{q.quarter.replace(" 20", " '")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs text-text-tertiary tabular-nums">{value}</span>
    </div>
  );
}
