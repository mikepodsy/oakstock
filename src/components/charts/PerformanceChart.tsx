"use client";

import {
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PortfolioChartPoint } from "@/types";
import { ChartTooltip } from "./ChartTooltip";
import { TimeRangePicker } from "./TimeRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import { format } from "date-fns";

interface PerformanceChartProps {
  data: PortfolioChartPoint[];
  benchmarkName: string;
  period: string;
  onPeriodChange: (period: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function CustomTooltip({
  active,
  label,
  payload,
  benchmarkName,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; dataKey: string }>;
  benchmarkName: string;
}) {
  if (!active || !payload || !label) return null;

  const portfolioVal = payload.find((p) => p.dataKey === "portfolioValue")?.value ?? null;
  const benchmarkVal = payload.find((p) => p.dataKey === "benchmarkValue")?.value ?? null;
  const difference = portfolioVal !== null && benchmarkVal !== null
    ? portfolioVal - benchmarkVal
    : null;

  const entries = [
    {
      name: "Portfolio",
      value: portfolioVal,
      color: "var(--green-primary)",
    },
    {
      name: benchmarkName,
      value: benchmarkVal,
      color: "var(--oak-300)",
    },
    {
      name: "Difference",
      value: difference,
      color: difference !== null && difference >= 0 ? "var(--green-primary)" : "var(--red-primary)",
    },
  ];

  return <ChartTooltip active={active} label={label} entries={entries} />;
}

export function PerformanceChart({
  data,
  benchmarkName,
  period,
  onPeriodChange,
  loading,
  error,
  onRetry,
}: PerformanceChartProps) {
  const costBasis = data.length > 0 ? data[0].costBasis : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-text-primary">
          Performance
        </h3>
        <TimeRangePicker selected={period} onSelect={onPeriodChange} />
      </div>

      {loading ? (
        <Skeleton className="h-[250px] md:h-[400px] w-full rounded-lg" />
      ) : error ? (
        <div className="h-[250px] md:h-[400px] flex flex-col items-center justify-center border border-border-primary rounded-lg">
          <p className="text-sm text-text-secondary mb-2">
            Unable to load chart data
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-green-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="h-[250px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--green-primary)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--green-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-primary)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(date: string) => format(new Date(date), "MMM d")}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                  tickFormatter={(v: number) => `$${formatCompactNumber(v)}`}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  content={
                    <CustomTooltip benchmarkName={benchmarkName} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke="var(--green-primary)"
                  strokeWidth={2}
                  fill="url(#greenGradient)"
                  isAnimationActive={true}
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkValue"
                  stroke="var(--oak-300)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                  connectNulls={false}
                />
                {costBasis > 0 && (
                  <ReferenceLine
                    y={costBasis}
                    stroke="var(--text-tertiary)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-primary" />
              <span className="text-xs text-text-secondary">Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-oak-300" />
              <span className="text-xs text-text-secondary">
                {benchmarkName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 border-t border-dashed border-text-tertiary" />
              <span className="text-xs text-text-secondary">Cost Basis</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
