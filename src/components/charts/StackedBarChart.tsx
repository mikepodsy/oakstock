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
import { Legend, LegendItem, LegendLabel, LegendMarker } from "./legend";
import { ChartTooltip } from "./tooltip";
import { YAxis } from "./y-axis";

interface StackedDatum {
  date: string;
  series1: number | null;
  series2: number | null;
  // BarChart takes an open record; the index signature lets these rows pass
  // through without a cast.
  [key: string]: unknown;
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
  heightClass,
}: {
  data: StackedDatum[];
  series1Color: string;
  series2Color: string;
  series1Label: string;
  series2Label: string;
  valuePrefix?: string;
  heightClass: string;
}) {
  const isAnnual = data.length > 0 && data.length <= 6;
  const fmt = (v: number) => `${valuePrefix}${formatCompactNumber(Math.abs(v))}`;

  // Keyed by the raw date so two periods that format alike stay separate bands.
  const tickLabel = (date: string) => formatDateLabel(date, isAnnual);

  return (
    <>
      <Legend
        className="mb-2 flex-row flex-wrap gap-x-4 gap-y-1"
        items={[
          { label: series1Label, value: 0, color: series1Color },
          { label: series2Label, value: 0, color: series2Color },
        ]}
      >
        <LegendItem>
          <LegendMarker />
          <LegendLabel />
        </LegendItem>
      </Legend>
      <BarChart
        className={heightClass}
        data={data}
        margin={{ top: 16, right: 8, bottom: 24, left: 56 }}
        stacked
        xDataKey="date"
      >
        <Grid horizontal />
        <Bar dataKey="series1" fill={series1Color} />
        <Bar dataKey="series2" fill={series2Color} />
        <BarXAxis formatLabel={tickLabel} />
        <YAxis formatValue={fmt} />
        <ChartTooltip
          rows={(point) => [
            {
              color: series1Color,
              label: series1Label,
              value: fmt(Number(point.series1)),
            },
            {
              color: series2Color,
              label: series2Label,
              value: fmt(Number(point.series2)),
            },
          ]}
          showDatePill={false}
        />
      </BarChart>
    </>
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
        <Dialog onOpenChange={setExpanded} open={expanded}>
          <DialogTrigger className="p-1 rounded-md hover:bg-bg-tertiary transition-colors">
            <Maximize2 className="w-3.5 h-3.5 text-text-tertiary" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <ChartContent
              data={data}
              heightClass="h-[350px]"
              series1Color={series1Color}
              series1Label={series1Label}
              series2Color={series2Color}
              series2Label={series2Label}
              valuePrefix={valuePrefix}
            />
          </DialogContent>
        </Dialog>
      </div>
      <ChartContent
        data={data}
        heightClass="h-[160px]"
        series1Color={series1Color}
        series1Label={series1Label}
        series2Color={series2Color}
        series2Label={series2Label}
        valuePrefix={valuePrefix}
      />
    </div>
  );
}
