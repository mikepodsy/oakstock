"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/formatters";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { Grid } from "./grid";
import { ChartTooltip } from "./tooltip";
import { YAxis } from "./y-axis";

interface BarDatum {
  date: string;
  value: number | null;
  // BarChart takes an open record; the index signature lets these rows pass
  // through without a cast.
  [key: string]: unknown;
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
  heightClass,
}: {
  data: BarDatum[];
  color: string;
  valuePrefix?: string;
  formatValue?: (v: number) => string;
  heightClass: string;
}) {
  const isAnnual = data.length > 0 && data.length <= 6;
  const fmt = formatValue ?? ((v: number) => defaultFormat(v, valuePrefix));

  // Keyed by the raw date so two periods that format alike stay separate bands.
  const tickLabel = (date: string) => formatDateLabel(date, isAnnual);

  return (
    <BarChart
      // `min-w-0` matters inside the expand dialog: it's a grid container, and a
      // grid item's default `min-width: auto` would let the measured SVG width
      // ratchet the track wider than the dialog on every re-measure.
      className={`min-w-0 ${heightClass}`}
      data={data}
      margin={{ top: 16, right: 8, bottom: 24, left: 56 }}
      xDataKey="date"
    >
      <Grid horizontal strokeOpacity={0.45} strokeWidth={0.5} />
      <Bar dataKey="value" fill={color} />
      <BarXAxis formatLabel={tickLabel} />
      <YAxis formatValue={fmt} />
      <ChartTooltip
        rows={(point) => [
          {
            color,
            label: tickLabel(String(point.date)),
            value: fmt(Number(point.value)),
          },
        ]}
        showDatePill={false}
      />
    </BarChart>
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
        <Dialog onOpenChange={setExpanded} open={expanded}>
          <DialogTrigger className="p-1 rounded-md hover:bg-bg-tertiary transition-colors">
            <Maximize2 className="w-3.5 h-3.5 text-text-tertiary" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[min(1400px,92vw)]">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <ChartContent
              color={color}
              data={data}
              formatValue={formatValue}
              // Scales with the viewport so the expanded view actually fills the
              // screen, with a ceiling so it stays readable on very tall displays.
              heightClass="h-[min(72vh,760px)]"
              valuePrefix={valuePrefix}
            />
          </DialogContent>
        </Dialog>
      </div>
      <ChartContent
        color={color}
        data={data}
        formatValue={formatValue}
        heightClass="h-[160px]"
        valuePrefix={valuePrefix}
      />
    </div>
  );
}
