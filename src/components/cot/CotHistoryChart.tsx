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
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { CotWeek } from "@/types";
import { formatCompactNumber, formatSignedContracts } from "@/utils/formatters";

// Distinct, dark-theme-friendly palette mapped to trader categories by index
const PALETTE = ["#3b82f6", "#eab308", "#ef4444", "#10b981", "#a855f7"];

const tooltipStyle = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
  borderRadius: 8,
  fontSize: 12,
};

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

export function CotHistoryChart({ history, categoryNames, title }: CotHistoryChartProps) {
  const [metric, setMetric] = useState<Metric>("net");
  const [rangeWeeks, setRangeWeeks] = useState<number>(13);

  const color = (name: string) => PALETTE[categoryNames.indexOf(name) % PALETTE.length];

  // Keep only the most recent N weeks so the bars fit without horizontal scroll.
  const weeks = history.slice(-rangeWeeks);
  const rangeLabel =
    RANGES.find((r) => r.weeks === rangeWeeks)?.label ?? `${rangeWeeks} Weeks`;

  // Thin x-axis labels to ~10 across the window so they don't overlap
  const tickInterval = Math.max(0, Math.ceil(weeks.length / 10) - 1);

  const data = weeks.map((week) => {
    const row: Record<string, string | number> = { date: week.reportDate };
    for (const cat of week.categories) {
      if (metric === "net") {
        row[cat.name] = cat.net;
      } else {
        row[`${cat.name} ▲`] = cat.longs;
        row[`${cat.name} ▼`] = -cat.shorts;
      }
    }
    return row;
  });

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {metric === "net"
              ? "Net position (longs − shorts) per week, by trader category."
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
                value={String(rangeWeeks)}
                onValueChange={(v) => setRangeWeeks(Number(v))}
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
            {([
              ["net", "Net"],
              ["longShort", "Long / Short"],
            ] as [Metric, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={metric === value}
                onClick={() => setMetric(value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  metric === value
                    ? "bg-green-muted text-green-primary"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
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
          <span key={name} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color(name) }}
            />
            {name}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
          barGap={1}
          barCategoryGap="12%"
          maxBarSize={28}
        >
          <CartesianGrid vertical={false} stroke="var(--border-primary)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            interval={tickInterval}
            tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompactNumber}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ReferenceLine y={0} stroke="var(--border-primary)" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label) => formatAxisDate(String(label))}
            formatter={(value, name) => [
              `${formatSignedContracts(Number(value))} contracts`,
              String(name),
            ]}
            cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
          />
          {metric === "net"
            ? categoryNames.map((name) => (
                // Stack the categories into one column per week (positives stack up,
                // negatives down) so the chart uses far less horizontal space.
                <Bar key={name} dataKey={name} stackId="net" fill={color(name)} />
              ))
            : categoryNames.flatMap((name) => [
                <Bar
                  key={`${name} ▲`}
                  dataKey={`${name} ▲`}
                  stackId="ls"
                  fill={color(name)}
                />,
                <Bar
                  key={`${name} ▼`}
                  dataKey={`${name} ▼`}
                  stackId="ls"
                  fill={color(name)}
                  fillOpacity={0.5}
                />,
              ])}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
