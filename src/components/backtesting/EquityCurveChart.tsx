"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/types/backtest";

// Deliberately not PerformanceChart: that component requires `period` and
// `onPeriodChange` and renders a TimeRangePicker, which is meaningless for a
// stored run with a fixed window, and it hardcodes a "Portfolio" legend label
// with no prop to change it.

interface EquityCurveChartProps {
  equity: EquityPoint[];
  ticker: string;
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
  ticker,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  ticker: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const nameFor = (key: string) =>
    key === "equity" ? "Strategy" : `Buy & hold ${ticker}`;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg">
      <p className="mb-1.5 text-xs text-text-secondary">
        {format(new Date(label), "MMM d, yyyy")}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {nameFor(entry.dataKey)}
          </span>
          <span className="font-financial text-text-primary">
            {entry.value?.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EquityCurveChart({
  equity,
  ticker,
  height = 320,
}: EquityCurveChartProps) {
  // Both series are rebased to 100 by the engine (initial_equity), so they are
  // directly comparable without any further normalisation here.
  const data = useMemo(
    () =>
      equity.map((p) => ({
        date: p.date,
        equity: p.equity,
        benchmark: p.benchmark_equity,
      })),
    [equity]
  );

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-tertiary">
        No equity data for this run
      </div>
    );
  }

  return (
    <ResponsiveContainer height={height} width="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--green-primary)"
              stopOpacity={0.28}
            />
            <stop
              offset="100%"
              stopColor="var(--green-primary)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          minTickGap={48}
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => format(new Date(v), "MMM ''yy")}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={["auto", "auto"]}
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v.toFixed(0)}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip ticker={ticker} />} />

        {/* A stored run is immutable, and these series are 1k-4k points — a
            reveal animation costs a lot of path interpolation to show nothing
            the user needs, and leaves the chart blank in headless capture. */}
        <Area
          dataKey="equity"
          fill="url(#equityFill)"
          isAnimationActive={false}
          stroke="var(--green-primary)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="benchmark"
          dot={false}
          isAnimationActive={false}
          stroke="var(--text-tertiary)"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
