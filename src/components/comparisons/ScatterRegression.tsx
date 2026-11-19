"use client";

import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompRow } from "@/lib/comps/metrics";
import { METRICS, formatMetric, type MetricId } from "@/lib/comps/registry";
import { ols, premium } from "@/lib/comps/stats";
import { MetricSelect } from "./MetricSelect";
import { PEER_COLOR, TARGET_COLOR, okRows } from "./shared";

interface Pt {
  ticker: string;
  x: number;
  y: number;
}

export function ScatterRegression({
  rows,
  target,
  x,
  y,
  onX,
  onY,
}: {
  rows: CompRow[];
  target: string;
  x: MetricId;
  y: MetricId;
  onX: (id: MetricId) => void;
  onY: (id: MetricId) => void;
}) {
  const dx = METRICS[x];
  const dy = METRICS[y];
  const pts: Pt[] = okRows(rows)
    .filter((r) => r.values[x] != null && r.values[y] != null)
    .map((r) => ({ ticker: r.ticker, x: r.values[x] as number, y: r.values[y] as number }));
  const targetPt = pts.find((p) => p.ticker === target);
  const peerPts = pts.filter((p) => p.ticker !== target);

  // Fit on peers only, so the target is judged against the group rather than
  // pulling the line toward itself.
  const fit = ols(peerPts);
  const xs = pts.map((p) => p.x);
  const line =
    fit && xs.length
      ? [Math.min(...xs), Math.max(...xs)].map((vx) => ({ x: vx, y: fit.slope * vx + fit.intercept }))
      : [];
  const implied = fit && targetPt ? fit.slope * targetPt.x + fit.intercept : null;
  const gap = targetPt && implied != null && implied > 0 ? premium(targetPt.y, implied) : null;

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base text-text-primary">Regression</h3>
          <p className="text-xs text-text-secondary">
            {fit
              ? `Peer best fit · R² ${fit.r2.toFixed(2)} · n=${fit.n}`
              : "Needs at least 3 peers with both values for a best-fit line"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MetricSelect label="X" value={x} onChange={onX} />
          <MetricSelect label="Y" value={y} onChange={onY} />
        </div>
      </div>

      {implied != null && targetPt && (
        <p className="mb-2 text-xs text-text-secondary">
          At its {dx.label} of {formatMetric(targetPt.x, dx.format)}, the peer line implies {target}{" "}
          {dy.label} of <span className="text-text-primary">{formatMetric(implied, dy.format)}</span> vs actual{" "}
          <span className="text-text-primary">{formatMetric(targetPt.y, dy.format)}</span>
          {gap != null && (
            <>
              {" "}
              (
              <span className={gap > 0 ? "text-red-primary" : "text-green-primary"}>
                {gap >= 0 ? "+" : ""}
                {(gap * 100).toFixed(0)}%
              </span>
              )
            </>
          )}
          .
        </p>
      )}

      {pts.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-text-secondary">
          No company has both values.
        </div>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 24, right: 32, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                type="number"
                dataKey="x"
                name={dx.label}
                domain={["auto", "auto"]}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => formatMetric(v, dx.format)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={dy.label}
                domain={["auto", "auto"]}
                width={56}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                tickFormatter={(v: number) => formatMetric(v, dy.format)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Pt | undefined;
                  if (!active || !p?.ticker) return null;
                  return (
                    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <p className="text-text-secondary">{p.ticker}</p>
                      <p className="font-financial text-text-primary">
                        {dx.short}: {formatMetric(p.x, dx.format)}
                      </p>
                      <p className="font-financial text-text-primary">
                        {dy.short}: {formatMetric(p.y, dy.format)}
                      </p>
                    </div>
                  );
                }}
              />
              {line.length > 0 && (
                <Scatter
                  data={line}
                  line={{ stroke: "var(--text-tertiary)", strokeDasharray: "5 4" }}
                  shape={() => <g />}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
              <Scatter data={peerPts} fill={PEER_COLOR} isAnimationActive={false}>
                <LabelList dataKey="ticker" position="top" fill="var(--text-secondary)" fontSize={11} />
              </Scatter>
              {targetPt && (
                <Scatter data={[targetPt]} fill={TARGET_COLOR} isAnimationActive={false} shape="diamond">
                  <LabelList dataKey="ticker" position="top" fill={TARGET_COLOR} fontSize={12} />
                </Scatter>
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
