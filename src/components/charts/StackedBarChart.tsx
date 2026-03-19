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
import { formatCompactNumber } from "@/utils/formatters";

interface StackedDatum {
  date: string;
  series1: number | null;
  series2: number | null;
}

interface StackedBarChartProps {
  title: string;
  data: StackedDatum[];
  series1Color: string;
  series2Color: string;
  series1Label: string;
  series2Label: string;
  loading?: boolean;
  valuePrefix?: string;
}

function formatDateLabel(dateStr: string, isAnnual: boolean): string {
  const d = new Date(dateStr);
  if (isAnnual) return d.getFullYear().toString();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  const yr = d.getFullYear().toString().slice(2);
  return `Q${q} '${yr}`;
}

function ChartContent({
  data,
  series1Color,
  series2Color,
  series1Label,
  series2Label,
  valuePrefix = "$",
  height,
}: {
  data: StackedDatum[];
  series1Color: string;
  series2Color: string;
  series1Label: string;
  series2Label: string;
  valuePrefix?: string;
  height: number;
}) {
  const isAnnual = data.length > 0 && data.length <= 6;
  const fmt = (v: number) => `${valuePrefix}${formatCompactNumber(Math.abs(v))}`;

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
          tickFormatter={fmt}
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
          formatter={(v, name) => [fmt(v as number), name as string]}
          labelFormatter={(d) => formatDateLabel(String(d), isAnnual)}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
        />
        <Bar
          dataKey="series1"
          name={series1Label}
          stackId="stack"
          fill={series1Color}
          radius={[0, 0, 0, 0]}
          animationDuration={600}
        />
        <Bar
          dataKey="series2"
          name={series2Label}
          stackId="stack"
          fill={series2Color}
          radius={[3, 3, 0, 0]}
          animationDuration={600}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedBarChart({
  title,
  data,
  series1Color,
  series2Color,
  series1Label,
  series2Label,
  loading,
  valuePrefix = "$",
}: StackedBarChartProps) {
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
              series1Color={series1Color}
              series2Color={series2Color}
              series1Label={series1Label}
              series2Label={series2Label}
              valuePrefix={valuePrefix}
              height={350}
            />
          </DialogContent>
        </Dialog>
      </div>
      <ChartContent
        data={data}
        series1Color={series1Color}
        series2Color={series2Color}
        series1Label={series1Label}
        series2Label={series2Label}
        valuePrefix={valuePrefix}
        height={160}
      />
    </div>
  );
}
