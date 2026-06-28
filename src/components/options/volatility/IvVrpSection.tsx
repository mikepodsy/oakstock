"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { VolHistoryPoint, VolStats } from "@/types/volatility";
import { VolStatCard, pct, pctRank } from "./VolStatCard";

// Stack the band between IV and HV so the gap reads green (IV>HV) or red (HV>IV).
interface BandPoint extends VolHistoryPoint {
  base: number | null;
  pos: number; // IV above HV
  neg: number; // HV above IV
}

function IvHvTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: BandPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  const vrp = p.vrp;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary mb-1">{format(new Date(label), "MMM d, yyyy")}</p>
      <Row name="IV" v={p.iv} color="var(--oak-300)" />
      <Row name="HV" v={p.hv} color="var(--text-secondary)" />
      <div className="flex items-center justify-between gap-4 mt-0.5">
        <span className="text-text-secondary">VRP</span>
        <span style={{ color: vrp != null && vrp >= 0 ? "var(--green-primary)" : "var(--red-primary)" }}>
          {vrp == null ? "—" : `${(vrp * 100).toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}

function Row({ name, v, color }: { name: string; v: number | null; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {name}
      </span>
      <span className="font-financial text-text-primary">{v == null ? "—" : `${(v * 100).toFixed(1)}%`}</span>
    </div>
  );
}

export function IvVrpSection({
  history,
  stats,
}: {
  history: VolHistoryPoint[];
  stats: VolStats;
}) {
  // Last ~252 trading days for the chart.
  const data: BandPoint[] = useMemo(() => {
    return history.slice(-252).map((p) => {
      const iv = p.iv;
      const hv = p.hv;
      const base = iv != null && hv != null ? Math.min(iv, hv) : null;
      return {
        ...p,
        base,
        pos: iv != null && hv != null && iv > hv ? iv - hv : 0,
        neg: iv != null && hv != null && hv > iv ? hv - iv : 0,
      };
    });
  }, [history]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <VolStatCard label="IV Rank" value={pctRank(stats.ivRank)} sub="vs 52-week range" />
        <VolStatCard label="IV Percentile" value={pctRank(stats.ivPercentile)} sub="past 252 days" />
        <VolStatCard
          label="Current VRP"
          value={stats.currentVrp == null ? "—" : `${stats.currentVrp >= 0 ? "+" : ""}${pct(stats.currentVrp, 1)}`}
          sub="IV − HV"
          tone={stats.currentVrp != null && stats.currentVrp >= 0 ? "pos" : "neg"}
        />
        <VolStatCard
          label="VRP Percentile"
          value={pctRank(stats.vrpPercentile)}
          sub={stats.avgVrp1y == null ? "1-yr" : `1-yr avg ${stats.avgVrp1y >= 0 ? "+" : ""}${pct(stats.avgVrp1y, 1)}`}
        />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <h3 className="font-display text-base text-text-primary mb-1">Implied vs Realized Vol</h3>
        <p className="text-xs text-text-secondary mb-3">
          Shaded gap is the variance risk premium — green when IV &gt; HV (premium sellers favored), red when HV &gt; IV.
        </p>
        {data.length === 0 ? (
          <Empty />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(d: string) => format(new Date(d), "MMM yy")}
                  minTickGap={40}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<IvHvTooltip />} />
                {/* Invisible base lifts the colored band up to min(IV,HV). */}
                <Area dataKey="base" stackId="vrp" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area dataKey="pos" stackId="vrp" stroke="none" fill="var(--green-primary)" fillOpacity={0.25} isAnimationActive={false} />
                <Area dataKey="neg" stackId="vrp" stroke="none" fill="var(--red-primary)" fillOpacity={0.25} isAnimationActive={false} />
                <Line dataKey="iv" stroke="var(--oak-300)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="hv" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center gap-4 mt-3">
          <Legend color="var(--oak-300)" label="Implied (IV)" />
          <Legend color="var(--text-secondary)" label="Realized (HV)" dashed />
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2 w-4"
        style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-[300px] flex items-center justify-center text-sm text-text-secondary">
      No IV/HV history available for this ticker.
    </div>
  );
}
