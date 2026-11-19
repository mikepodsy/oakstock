"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoryPoint } from "@/lib/comps/history";
import { median } from "@/lib/comps/stats";
import { PEER_COLOR, TARGET_COLOR } from "./shared";

/**
 * Y-axis ceiling that ignores near-zero-earnings spikes (a 600x month would
 * flatten everything else): 3× the median of every plotted value, or the true
 * max if that's lower. Points above run off the top of the chart.
 */
function yCeiling(points: HistoryPoint[]): number | "auto" {
  const vals = points.flatMap((p) => [p.target, p.peerMedian]).filter((v): v is number => v != null);
  const mid = median(vals);
  if (mid == null) return "auto";
  return Math.ceil(Math.min(Math.max(...vals), mid * 3) / 10) * 10;
}

const fmt = (v: number | null | undefined) => (v == null ? "NM" : `${v.toFixed(1)}x`);

export function HistoryChart({
  target,
  points,
  loading,
  error,
}: {
  target: string;
  points: HistoryPoint[] | null;
  loading: boolean;
  error: string | null;
}) {
  const hasData = points?.some((p) => p.target != null || p.peerMedian != null);

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="font-display text-base text-text-primary">Historical P/E vs peers</h3>
      <p className="mb-3 text-xs text-text-secondary">
        Monthly trailing P/E (market cap ÷ TTM net income) over 5 years. Gaps are periods with losses or
        missing quarterly data; extreme spikes from near-zero earnings run off the top. EV-based history
        isn&apos;t available yet.
      </p>
      {loading && !points ? (
        <Skeleton className="h-[300px] w-full" />
      ) : error ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-text-secondary">{error}</div>
      ) : !hasData ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-text-secondary">
          Not enough quarterly history to chart.
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points ?? []} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(d: string) => (d.endsWith("-01") ? d.slice(0, 4) : "")}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={48}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}x`}
                axisLine={false}
                tickLine={false}
                domain={[0, yCeiling(points ?? [])]}
                allowDataOverflow
              />
              <Tooltip
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as HistoryPoint | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <p className="text-text-secondary">{p.date}</p>
                      <p className="font-financial" style={{ color: TARGET_COLOR }}>
                        {target}: {fmt(p.target)}
                      </p>
                      <p className="font-financial text-text-primary">
                        Peer median: {fmt(p.peerMedian)}{" "}
                        <span className="text-text-tertiary">({p.peerCount} with data)</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                name={target}
                dataKey="target"
                stroke={TARGET_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                name="Peer median"
                dataKey="peerMedian"
                stroke={PEER_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
