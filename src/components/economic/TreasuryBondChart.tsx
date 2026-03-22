"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TreasuryBundleData, TreasuryMaturity } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface TreasuryBondChartProps {
  data: TreasuryBundleData | null;
  loading: boolean;
}

const MATURITY_COLORS: Record<TreasuryMaturity, string> = {
  "1mo": "#94a3b8",
  "3mo": "#64748b",
  "6mo": "#8b5cf6",
  "1y": "#a855f7",
  "2y": "#3b82f6",
  "5y": "#06b6d4",
  "10y": "#10b981",
  "20y": "#f59e0b",
  "30y": "#ef4444",
};

const ALL_MATURITIES: TreasuryMaturity[] = [
  "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "20y", "30y",
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg max-w-xs">
      <p className="text-xs text-text-secondary mb-2">
        {format(new Date(label), "MMM d, yyyy")}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-text-secondary">{entry.dataKey}</span>
            </div>
            <span className="text-xs font-financial text-text-primary">
              {entry.value.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TreasuryBondChart({ data, loading }: TreasuryBondChartProps) {
  const [selected, setSelected] = useState<Set<TreasuryMaturity>>(
    new Set(["2y", "5y", "10y", "30y"])
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-[350px] w-full rounded-lg" />
      </div>
    );
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <h3 className="text-lg font-display text-text-primary mb-2">
          Treasury Yields
        </h3>
        <div className="h-[350px] flex items-center justify-center">
          <p className="text-sm text-text-secondary">No data available</p>
        </div>
      </div>
    );
  }

  const toggle = (maturity: TreasuryMaturity) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(maturity)) {
        if (next.size > 1) next.delete(maturity);
      } else {
        next.add(maturity);
      }
      return next;
    });
  };

  // Merge all selected series into a unified date-keyed dataset
  const dateMap = new Map<string, Record<string, number>>();
  for (const series of data.series) {
    if (!selected.has(series.maturity)) continue;
    for (const point of series.data) {
      if (!dateMap.has(point.date)) dateMap.set(point.date, {});
      dateMap.get(point.date)![series.label] = point.value;
    }
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  const selectedSeries = data.series.filter((s) => selected.has(s.maturity));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <h3 className="text-lg font-display text-text-primary mb-4">
        Treasury Yields
      </h3>

      {/* Maturity Toggle Buttons */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ALL_MATURITIES.map((maturity) => {
          const series = data.series.find((s) => s.maturity === maturity);
          const isActive = selected.has(maturity);
          return (
            <button
              key={maturity}
              onClick={() => toggle(maturity)}
              className={`px-2.5 py-1 text-xs rounded-md transition-all border ${
                isActive
                  ? "border-border-primary bg-bg-elevated text-text-primary"
                  : "border-transparent bg-bg-tertiary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor: isActive
                    ? MATURITY_COLORS[maturity]
                    : "var(--text-tertiary)",
                  opacity: isActive ? 1 : 0.4,
                }}
              />
              {series?.label ?? maturity}
              {isActive && series?.currentValue != null && (
                <span className="ml-1 font-financial">
                  {series.currentValue.toFixed(2)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-primary)"
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            tickFormatter={(date: string) => format(new Date(date), "MMM yy")}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          {selectedSeries.map((series) => (
            <Line
              key={series.maturity}
              type="monotone"
              dataKey={series.label}
              stroke={MATURITY_COLORS[series.maturity]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
