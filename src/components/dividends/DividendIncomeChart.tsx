"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MonthlyIncome } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface DividendIncomeChartProps {
  data: MonthlyIncome[];
  loading: boolean;
  error: string | null;
}

type Aggregation = "monthly" | "quarterly";

function toQuarterKey(month: string): string {
  const [year, m] = month.split("-");
  const q = Math.ceil(Number(m) / 3);
  return `${year}-Q${q}`;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} '${year.slice(2)}`;
}

export function DividendIncomeChart({
  data,
  loading,
  error,
}: DividendIncomeChartProps) {
  const [aggregation, setAggregation] = useState<Aggregation>("monthly");

  const chartData = useMemo(() => {
    if (aggregation === "monthly") {
      return data.map((d) => ({
        label: formatMonthLabel(d.month),
        value: d.totalIncome,
      }));
    }

    const quarterMap = new Map<string, number>();
    for (const d of data) {
      const qKey = toQuarterKey(d.month);
      quarterMap.set(qKey, (quarterMap.get(qKey) ?? 0) + d.totalIncome);
    }

    return Array.from(quarterMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: key, value }));
  }, [data, aggregation]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
        <h2 className="text-lg font-display text-text-primary mb-2">
          Dividend Income History
        </h2>
        <p className="text-sm text-text-secondary">
          Unable to load income history. Please try again later.
        </p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
        <h2 className="text-lg font-display text-text-primary mb-2">
          Dividend Income History
        </h2>
        <p className="text-sm text-text-secondary">
          No dividend payments recorded yet. Income will appear here as dividends are paid.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display text-text-primary">
          Dividend Income History
        </h2>
        <div className="flex gap-1 rounded-lg bg-bg-tertiary p-0.5">
          <button
            onClick={() => setAggregation("monthly")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              aggregation === "monthly"
                ? "bg-bg-secondary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAggregation("quarterly")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              aggregation === "quarterly"
                ? "bg-bg-secondary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Quarterly
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-primary)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [formatCurrency(v as number), "Income"]}
          />
          <Bar
            dataKey="value"
            fill="var(--green-primary)"
            radius={[3, 3, 0, 0]}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
