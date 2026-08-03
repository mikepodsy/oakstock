"use client";

import { format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { OverlappingBars } from "@/components/charts/overlapping-bars";
import { SignedStackedBars } from "@/components/charts/signed-stacked-bars";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import { ZeroLine } from "@/components/charts/zero-line";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CotWeek } from "@/types";
import { formatCompactNumber, formatSignedContracts } from "@/utils/formatters";

// Distinct, dark-theme-friendly palette mapped to trader categories by index
const PALETTE = ["#3b82f6", "#eab308", "#ef4444", "#10b981", "#a855f7"];

type Metric = "net" | "longShort";

// Selectable look-back windows so the chart fits the container width without
// horizontal scrolling. Weeks are sliced from the end (most recent).
const RANGES = [
  { weeks: 13, label: "Quarter" },
  { weeks: 26, label: "Half Year" },
  { weeks: 52, label: "52 Weeks" },
] as const;

interface CotHistoryChartProps {
  history: CotWeek[];
  categoryNames: string[];
  title: string;
}

function formatAxisDate(date: string): string {
  try {
    return format(parseISO(date), "MMM ''yy");
  } catch {
    return date;
  }
}

export function CotHistoryChart({
  history,
  categoryNames,
  title,
}: CotHistoryChartProps) {
  const [metric, setMetric] = useState<Metric>("net");
  const [rangeWeeks, setRangeWeeks] = useState<number>(13);

  const color = (name: string) =>
    PALETTE[categoryNames.indexOf(name) % PALETTE.length];

  // Keep only the most recent N weeks so the bars fit without horizontal scroll.
  const weeks = history.slice(-rangeWeeks);
  const rangeLabel =
    RANGES.find((r) => r.weeks === rangeWeeks)?.label ?? `${rangeWeeks} Weeks`;

  const isNet = metric === "net";

  const longKey = (name: string) => `${name} ▲`;
  const shortKey = (name: string) => `${name} ▼`;

  const data = weeks.map((week) => {
    // Keyed by the raw report date — several weeks share a "MMM 'yy" label, and
    // duplicate category keys would collapse into a single band.
    const row: Record<string, string | number> = {
      date: week.reportDate,
    };
    if (isNet) {
      for (const cat of week.categories) {
        row[cat.name] = cat.net;
      }
    } else {
      for (const cat of week.categories) {
        row[longKey(cat.name)] = cat.longs;
        row[shortKey(cat.name)] = -cat.shorts;
      }
    }
    return row;
  });

  const netSeries = categoryNames.map((name) => ({
    dataKey: name,
    color: color(name),
  }));

  const longShortSeries = categoryNames.flatMap((name) => [
    { dataKey: longKey(name), color: color(name) },
    { dataKey: shortKey(name), color: color(name), opacity: 0.5 },
  ]);

  // The value domain is derived from the chart's <Bar> children. The bars are
  // drawn by OverlappingBars / SignedStackedBars instead, so register a
  // transparent Bar per series purely to feed the scale.
  const domainKeys = isNet
    ? netSeries.map((s) => s.dataKey)
    : longShortSeries.map((s) => s.dataKey);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {isNet
              ? "Net position (longs − shorts) per week — up = net long, down = net short. Bars overlap, smallest in front."
              : "Gross longs (up) and shorts (down) per week, stacked by category."}
          </p>
        </div>
        {/* Range + metric controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Look-back range dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              {rangeLabel}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                onValueChange={(v) => setRangeWeeks(Number(v))}
                value={String(rangeWeeks)}
              >
                {RANGES.map((r) => (
                  <DropdownMenuRadioItem key={r.weeks} value={String(r.weeks)}>
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Metric toggle */}
          <div className="flex gap-1">
            {(
              [
                ["net", "Net"],
                ["longShort", "Long / Short"],
              ] as [Metric, string][]
            ).map(([value, label]) => (
              <button
                aria-pressed={metric === value}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  metric === value
                    ? "bg-green-muted text-green-primary"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
                key={value}
                onClick={() => setMetric(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend (color → category) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 mt-2">
        {categoryNames.map((name) => (
          <span
            className="flex items-center gap-1.5 text-xs text-text-secondary"
            key={name}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color(name) }}
            />
            {name}
          </span>
        ))}
      </div>

      <BarChart
        className="h-[320px]"
        data={data}
        key={metric}
        margin={{ top: 16, right: 8, bottom: 24, left: 52 }}
        stacked={!isNet}
        xDataKey="date"
      >
        <Grid horizontal />
        {domainKeys.map((dataKey) => (
          <Bar animate={false} dataKey={dataKey} fill="transparent" key={dataKey} />
        ))}
        {isNet ? (
          <OverlappingBars maxBarWidth={28} series={netSeries} />
        ) : (
          <SignedStackedBars maxBarWidth={28} series={longShortSeries} />
        )}
        <ZeroLine stroke="var(--border-primary)" />
        <BarXAxis formatLabel={formatAxisDate} maxLabels={10} />
        <YAxis formatValue={formatCompactNumber} />
        <ChartTooltip
          rows={(point) =>
            (isNet
              ? categoryNames.map((name) => ({
                  name,
                  value: Number(point[name] ?? 0),
                }))
              : categoryNames.flatMap((name) => [
                  {
                    name: longKey(name),
                    value: Number(point[longKey(name)] ?? 0),
                  },
                  {
                    name: shortKey(name),
                    value: Number(point[shortKey(name)] ?? 0),
                  },
                ])
            )
              .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
              .map((row) => ({
                color: color(row.name.replace(/ [▲▼]$/, "")),
                label: row.name,
                value: `${formatSignedContracts(row.value)} contracts`,
              }))
          }
          showDatePill={false}
          showDots={false}
        />
      </BarChart>
    </div>
  );
}
