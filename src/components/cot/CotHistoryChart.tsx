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

// Props Recharts hands a Bar's custom `shape` for each data point. Kept loose so
// the function stays assignable to Recharts' shape type (nullable geometry).
interface NetShapeProps {
  x?: number;
  width?: number;
  background?: { y?: number | null; height?: number | null };
  payload?: Record<string, unknown>;
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
    if (metric === "net") {
      // Anchor value so the custom shape is drawn for every week; the real per
      // category nets are read from the row inside the shape.
      row._anchor = 1;
      for (const cat of week.categories) {
        row[cat.name] = cat.net;
      }
    } else {
      for (const cat of week.categories) {
        row[`${cat.name} ▲`] = cat.longs;
        row[`${cat.name} ▼`] = -cat.shorts;
      }
    }
    return row;
  });

  // Fixed y-domain for the net view so the custom shape can map values → pixels
  // the same way the axis does. Always includes zero so up/down read correctly.
  const netValues =
    metric === "net" ? weeks.flatMap((w) => w.categories.map((c) => c.net)) : [];
  const dMin = Math.min(0, ...netValues);
  const dMax = Math.max(0, ...netValues);
  const netRange = dMax - dMin || 1;
  const netDomain: [number, number] = [dMin - netRange * 0.02, dMax + netRange * 0.06];

  // Overlapping net bars: for each week draw every category as a full-width bar
  // from zero (up when net long, down when net short). Larger magnitudes are
  // drawn first (behind) and smaller ones last (in front) so no bar is hidden.
  const renderNetBars = (props: NetShapeProps) => {
    const { x = 0, width = 0, background, payload } = props;
    if (!background || !payload) return <g />;
    const bgY = background.y ?? 0;
    const bgH = background.height ?? 0;
    const [lo, hi] = netDomain;
    if (hi === lo || bgH === 0) return <g />;
    const pixel = (v: number) => bgY + ((hi - v) / (hi - lo)) * bgH;
    const zeroY = pixel(0);

    const bars = categoryNames
      .map((name) => ({ name, v: Number(payload[name] ?? 0) }))
      .filter((b) => b.v !== 0)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); // largest first → drawn behind

    return (
      <g>
        {bars.map(({ name, v }) => {
          const vy = pixel(v);
          const top = Math.min(vy, zeroY);
          const h = Math.max(Math.abs(zeroY - vy), 1);
          return (
            <rect key={name} x={x} y={top} width={width} height={h} rx={1} fill={color(name)} />
          );
        })}
      </g>
    );
  };

  // Custom tooltip for the net view — the overlapping bars are one Recharts
  // series, so list each category's net from the hovered week's row.
  const renderNetTooltip = (props: {
    active?: boolean;
    label?: unknown;
    payload?: readonly { payload?: Record<string, unknown> }[];
  }) => {
    if (!props.active || !props.payload?.length) return null;
    const row = props.payload[0]?.payload;
    if (!row) return null;
    const items = categoryNames
      .map((name) => ({ name, v: Number(row[name] ?? 0) }))
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return (
      <div style={{ ...tooltipStyle, padding: "8px 10px" }}>
        <div className="text-xs text-text-secondary mb-1">
          {formatAxisDate(String(props.label))}
        </div>
        {items.map(({ name, v }) => (
          <div key={name} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: color(name) }}
            />
            <span className="text-text-secondary">{name}</span>
            <span className="ml-auto pl-3 font-mono text-text-primary">
              {formatSignedContracts(v)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {metric === "net"
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
            domain={metric === "net" ? netDomain : undefined}
            tickFormatter={formatCompactNumber}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ReferenceLine y={0} stroke="var(--border-primary)" />
          {metric === "net" ? (
            <Tooltip
              content={renderNetTooltip}
              cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
            />
          ) : (
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(label) => formatAxisDate(String(label))}
              formatter={(value, name) => [
                `${formatSignedContracts(Number(value))} contracts`,
                String(name),
              ]}
              cursor={{ fill: "var(--bg-tertiary)", opacity: 0.4 }}
            />
          )}
          {metric === "net" ? (
            // Single series drives layout; the custom shape draws every category's
            // overlapping bar for the week (see renderNetBars).
            <Bar
              dataKey="_anchor"
              background={{ fill: "transparent" }}
              shape={renderNetBars}
              isAnimationActive={false}
            />
          ) : (
            categoryNames.flatMap((name) => [
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
            ])
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
