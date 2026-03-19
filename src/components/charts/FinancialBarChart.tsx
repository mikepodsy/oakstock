"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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
import { formatCompactNumber } from "@/utils/formatters";

interface BarDatum {
  date: string;
  value: number | null;
}

interface FinancialBarChartProps {
  title: string;
  data: BarDatum[];
  color: string;
  loading?: boolean;
  valuePrefix?: string;
  formatValue?: (v: number) => string;
}

function formatDateLabel(dateStr: string, isAnnual: boolean): string {
  const d = new Date(dateStr);
  if (isAnnual) return d.getFullYear().toString();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  const yr = d.getFullYear().toString().slice(2);
  return `Q${q} '${yr}`;
}

function defaultFormat(v: number, prefix: string): string {
  return `${prefix}${formatCompactNumber(Math.abs(v))}`;
}

function ChartContent({
  data,
  color,
  valuePrefix = "$",
  formatValue,
  height,
}: {
  data: BarDatum[];
  color: string;
  valuePrefix?: string;
  formatValue?: (v: number) => string;
  height: number;
}) {
  const isAnnual = data.length > 0 && data.length <= 6;
  const fmt = formatValue ?? ((v: number) => defaultFormat(v, valuePrefix));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
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
          tickFormatter={(v: number) => fmt(v)}
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
          formatter={(v) => [fmt(v as number), ""]}
          labelFormatter={(d) => formatDateLabel(String(d), isAnnual)}
        />
        <Bar
          dataKey="value"
          fill={color}
          radius={[3, 3, 0, 0]}
          animationDuration={600}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FinancialBarChart({
  title,
  data,
  color,
  loading,
  valuePrefix = "$",
  formatValue,
}: FinancialBarChartProps) {
  const [expanded, setExpanded] = useState(false);

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
            <ChartContent
              data={data}
              color={color}
              valuePrefix={valuePrefix}
              formatValue={formatValue}
              height={350}
            />
          </DialogContent>
        </Dialog>
      </div>
      <ChartContent
        data={data}
        color={color}
        valuePrefix={valuePrefix}
        formatValue={formatValue}
        height={160}
      />
    </div>
  );
}
