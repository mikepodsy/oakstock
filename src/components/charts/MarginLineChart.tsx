"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Maximize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FinancialStatement } from "@/types";

interface MarginLineChartProps {
  title: string;
  data: FinancialStatement[];
  loading?: boolean;
}

interface MarginDatum {
  date: string;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

function toMarginData(statements: FinancialStatement[]): MarginDatum[] {
  return statements.map((s) => ({
    date: s.date,
    grossMargin:
      s.grossProfit != null && s.revenue
        ? +((s.grossProfit / s.revenue) * 100).toFixed(1)
        : null,
    operatingMargin:
      s.operatingIncome != null && s.revenue
        ? +((s.operatingIncome / s.revenue) * 100).toFixed(1)
        : null,
    netMargin:
      s.netIncome != null && s.revenue
        ? +((s.netIncome / s.revenue) * 100).toFixed(1)
        : null,
  }));
}

function formatDateLabel(dateStr: string, isAnnual: boolean): string {
  const d = new Date(dateStr);
  if (isAnnual) return d.getFullYear().toString();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  const yr = d.getFullYear().toString().slice(2);
  return `Q${q} '${yr}`;
}

const LINES = [
  { dataKey: "grossMargin", label: "Gross", color: "#22c55e" },
  { dataKey: "operatingMargin", label: "Operating", color: "#3b82f6" },
  { dataKey: "netMargin", label: "Net", color: "#a855f7" },
] as const;

function ChartContent({
  data,
  height,
}: {
  data: MarginDatum[];
  height: number;
}) {
  const isAnnual = data.length > 0 && data.length <= 6;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-primary)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatDateLabel(d, isAnnual)}
          tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v, name) => [`${v}%`, name as string]}
          labelFormatter={(d) => formatDateLabel(String(d), isAnnual)}
        />
        <Legend
          iconType="line"
          iconSize={12}
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
        />
        {LINES.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 3, fill: line.color }}
            connectNulls
            animationDuration={600}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MarginLineChart({
  title,
  data,
  loading,
}: MarginLineChartProps) {
  const [expanded, setExpanded] = useState(false);
  const marginData = toMarginData(data);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-[160px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogTrigger>
            <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors">
              <Maximize2 className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <ChartContent data={marginData} height={350} />
          </DialogContent>
        </Dialog>
      </div>
      <ChartContent data={marginData} height={160} />
    </div>
  );
}
