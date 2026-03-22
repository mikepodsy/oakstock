"use client";

import { forwardRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EconomicIndicatorData } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

function formatDisplayValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "Index") return value.toFixed(2);
  return `$${value.toFixed(2)}`;
}

interface EconomicChartProps {
  data: EconomicIndicatorData | null;
  loading: boolean;
  title: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const value = payload[0].value;
  const formatted = formatDisplayValue(value, unit);

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg">
      <p className="text-xs text-text-secondary mb-1">
        {format(new Date(label), "MMM d, yyyy")}
      </p>
      <p className="text-sm font-financial text-text-primary">{formatted}</p>
    </div>
  );
}

export const EconomicChart = forwardRef<HTMLDivElement, EconomicChartProps>(
  function EconomicChart({ data, loading, title }, ref) {
    if (loading) {
      return (
        <div ref={ref} className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      );
    }

    if (!data || data.data.length === 0) {
      return (
        <div ref={ref} className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <h3 className="text-lg font-display text-text-primary mb-2">{title}</h3>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-text-secondary">No data available</p>
          </div>
        </div>
      );
    }

    const formatYAxis = (value: number) => {
      if (data.unit === "%") return `${value.toFixed(1)}%`;
      if (data.unit === "Index") return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    return (
      <div ref={ref} className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <h3 className="text-lg font-display text-text-primary mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data.data}
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
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              content={<CustomTooltip unit={data.unit} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--green-primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
