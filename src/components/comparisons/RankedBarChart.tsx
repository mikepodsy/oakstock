"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CompRow } from "@/lib/comps/metrics";
import { METRICS, formatMetric, type MetricId } from "@/lib/comps/registry";
import { MetricSelect } from "./MetricSelect";
import { PEER_COLOR, TARGET_COLOR, okRows, peerMedian } from "./shared";

export function RankedBarChart({
  rows,
  target,
  metric,
  onMetric,
}: {
  rows: CompRow[];
  target: string;
  metric: MetricId;
  onMetric: (id: MetricId) => void;
}) {
  const def = METRICS[metric];
  const data = okRows(rows)
    .filter((r) => r.values[metric] != null)
    .map((r) => ({ ticker: r.ticker, value: r.values[metric] as number }))
    // Best first: cheapest multiple / highest margin at the top.
    .sort((a, b) => (def.direction === "lower" ? a.value - b.value : b.value - a.value));
  const med = peerMedian(rows, target, metric);
  const nm = okRows(rows).length - data.length;

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base text-text-primary">Ranking</h3>
          <p className="text-xs text-text-secondary">
            {def.direction === "lower" ? "Lowest (cheapest) first" : "Highest first"}
            {med != null && ` · dashed line = peer median ${formatMetric(med, def.format)}`}
            {nm > 0 && ` · ${nm} NM`}
          </p>
        </div>
        <MetricSelect label="Metric" value={metric} onChange={onMetric} />
      </div>
      {data.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-text-secondary">
          No company has a meaningful {def.label}.
        </div>
      ) : (
        <div style={{ height: Math.max(220, data.length * 30 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
              <XAxis
                type="number"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => formatMetric(v, def.format)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                width={64}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { ticker: string; value: number } | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <p className="text-text-secondary">{p.ticker}</p>
                      <p className="font-financial text-text-primary">
                        {def.label}: {formatMetric(p.value, def.format)}
                      </p>
                    </div>
                  );
                }}
              />
              {med != null && <ReferenceLine x={med} stroke="var(--text-tertiary)" strokeDasharray="4 4" />}
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
                label={{
                  position: "right",
                  fill: "var(--text-secondary)",
                  fontSize: 11,
                  formatter: (v: unknown) => formatMetric(Number(v), def.format),
                }}
              >
                {data.map((d) => (
                  <Cell key={d.ticker} fill={d.ticker === target ? TARGET_COLOR : PEER_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
