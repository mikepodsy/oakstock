"use client";

import { useEffect, useMemo, useState } from "react";
import { getPeriodStartDate } from "@/lib/history-utils";

interface SeriesPoint { date: string; fund: number; sp500: number | null; nasdaq: number | null; }
interface PerformanceData {
  mode: "vehicle" | "reconstructed";
  ticker: string | null;
  holdings_used: number;
  series: SeriesPoint[];
  sharpe: number | null;
}

function pct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// % change of the fund series over a period window.
function periodReturn(series: SeriesPoint[], period: string): number | null {
  const cutoff = getPeriodStartDate(period).toISOString().split("T")[0];
  const slice = series.filter((p) => p.date >= cutoff);
  if (slice.length < 2) return null;
  const base = slice[0].fund;
  return base > 0 ? (slice[slice.length - 1].fund / base - 1) * 100 : null;
}

function Widget({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
      <p className="text-text-tertiary text-xs mb-1">{label}</p>
      <p className={`font-bold text-lg tabular-nums ${color ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

// Small fund-performance widgets (period returns + Sharpe) shown alongside the
// Portfolio Value / Holdings boxes. Renders a fragment of grid cells.
export function FundPerformance({ managerId }: { managerId: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/experts/${managerId}/performance`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && !d.error) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [managerId]);

  const r = useMemo(() => {
    const s = data?.series ?? [];
    return {
      ytd: periodReturn(s, "ytd"),
      y1: periodReturn(s, "1y"),
      y5: periodReturn(s, "5y"),
    };
  }, [data]);

  const ret = (n: number | null) =>
    n === null ? undefined : n >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <>
      <Widget label="YTD Return" value={pct(r.ytd)} color={ret(r.ytd)} />
      <Widget label="1Y Return" value={pct(r.y1)} color={ret(r.y1)} />
      <Widget label="5Y Return" value={pct(r.y5)} color={ret(r.y5)} />
      <Widget
        label={`Sharpe${data?.mode === "reconstructed" ? " (10y)" : ""}`}
        value={data?.sharpe != null ? data.sharpe.toFixed(2) : "—"}
      />
    </>
  );
}
