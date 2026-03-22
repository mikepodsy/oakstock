"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TreasuryBundleData, TreasuryMaturity, TreasurySeriesData } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Maximize2, X } from "lucide-react";

interface TreasuryBondChartProps {
  data: TreasuryBundleData | null;
  loading: boolean;
}

const MATURITY_COLORS: Record<TreasuryMaturity, string> = {
  "1mo": "#94a3b8",
  "3mo": "#64748b",
  "6mo": "#8b5cf6",
  "1y": "#a855f7",
  "2y": "#3b82f6",
  "5y": "#06b6d4",
  "10y": "#10b981",
  "20y": "#f59e0b",
  "30y": "#ef4444",
};

const ALL_MATURITIES: TreasuryMaturity[] = [
  "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "20y", "30y",
];

const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "5Y", months: 60 },
  { label: "10Y", months: 120 },
  { label: "20Y", months: 240 },
  { label: "ALL", months: 0 },
] as const;

function filterDatesByRange(
  dates: string[],
  months: number
): Set<string> {
  if (months === 0) return new Set(dates);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return new Set(dates.filter((d) => d >= cutoffStr));
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg max-w-xs">
      <p className="text-xs text-text-secondary mb-2">
        {format(new Date(label), "MMM d, yyyy")}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-text-secondary">{entry.dataKey}</span>
            </div>
            <span className="text-xs font-financial text-text-primary">
              {entry.value.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildChartData(
  series: TreasurySeriesData[],
  selected: Set<TreasuryMaturity>,
  months: number
) {
  const dateMap = new Map<string, Record<string, number>>();
  const allDates: string[] = [];

  for (const s of series) {
    if (!selected.has(s.maturity)) continue;
    for (const point of s.data) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, {});
        allDates.push(point.date);
      }
      dateMap.get(point.date)![s.label] = point.value;
    }
  }

  const validDates = filterDatesByRange(allDates, months);

  return Array.from(dateMap.entries())
    .filter(([date]) => validDates.has(date))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

function TreasuryChartContent({
  data,
  selected,
  months,
  height,
}: {
  data: TreasuryBundleData;
  selected: Set<TreasuryMaturity>;
  months: number;
  height: number;
}) {
  const chartData = useMemo(
    () => buildChartData(data.series, selected, months),
    [data, selected, months]
  );

  const selectedSeries = data.series.filter((s) => selected.has(s.maturity));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
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
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        {selectedSeries.map((series) => (
          <Line
            key={series.maturity}
            type="monotone"
            dataKey={series.label}
            stroke={MATURITY_COLORS[series.maturity]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function MaturityToggles({
  data,
  selected,
  toggle,
}: {
  data: TreasuryBundleData;
  selected: Set<TreasuryMaturity>;
  toggle: (m: TreasuryMaturity) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {ALL_MATURITIES.map((maturity) => {
        const series = data.series.find((s) => s.maturity === maturity);
        const isActive = selected.has(maturity);
        return (
          <button
            key={maturity}
            onClick={() => toggle(maturity)}
            className={`px-2.5 py-1 text-xs rounded-md transition-all border ${
              isActive
                ? "border-border-primary bg-bg-elevated text-text-primary"
                : "border-transparent bg-bg-tertiary text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{
                backgroundColor: isActive
                  ? MATURITY_COLORS[maturity]
                  : "var(--text-tertiary)",
                opacity: isActive ? 1 : 0.4,
              }}
            />
            {series?.label ?? maturity}
            {isActive && series?.currentValue != null && (
              <span className="ml-1 font-financial">
                {series.currentValue.toFixed(2)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TimeRangeButtons({
  current,
  onChange,
  size = "sm",
}: {
  current: string;
  onChange: (label: string) => void;
  size?: "sm" | "md";
}) {
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={`flex ${gap} rounded-lg bg-bg-tertiary p-0.5`}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.label}
          onClick={() => onChange(r.label)}
          className={`${px} rounded-md transition-colors ${
            current === r.label
              ? "bg-bg-secondary text-text-primary shadow-sm"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function TreasuryBondChart({ data, loading }: TreasuryBondChartProps) {
  const [selected, setSelected] = useState<Set<TreasuryMaturity>>(
    new Set(["2y", "5y", "10y", "30y"])
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [cardRange, setCardRange] = useState("ALL");
  const [modalRange, setModalRange] = useState("ALL");

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setFullscreen(false);
  }, []);

  useEffect(() => {
    if (fullscreen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [fullscreen, handleEsc]);

  useEffect(() => {
    if (fullscreen) setModalRange(cardRange);
  }, [fullscreen, cardRange]);

  const cardMonths = TIME_RANGES.find((r) => r.label === cardRange)?.months ?? 0;
  const modalMonths = TIME_RANGES.find((r) => r.label === modalRange)?.months ?? 0;

  const toggle = (maturity: TreasuryMaturity) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(maturity)) {
        if (next.size > 1) next.delete(maturity);
      } else {
        next.add(maturity);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-[350px] w-full rounded-lg" />
      </div>
    );
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <h3 className="text-lg font-display text-text-primary mb-2">
          Treasury Yields
        </h3>
        <div className="h-[350px] flex items-center justify-center">
          <p className="text-sm text-text-secondary">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display text-text-primary">
            Treasury Yields
          </h3>
          <div className="flex items-center gap-2">
            <TimeRangeButtons current={cardRange} onChange={setCardRange} size="sm" />
            <button
              onClick={() => setFullscreen(true)}
              className="p-1 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <MaturityToggles data={data} selected={selected} toggle={toggle} />
        <TreasuryChartContent data={data} selected={selected} months={cardMonths} height={300} />
      </div>

      {/* Fullscreen Modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-bg-primary/60 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="w-full max-w-6xl rounded-xl border border-border-primary bg-bg-secondary p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display text-text-primary">
                Treasury Yields
              </h3>
              <div className="flex items-center gap-3">
                <TimeRangeButtons current={modalRange} onChange={setModalRange} size="md" />
                <button
                  onClick={() => setFullscreen(false)}
                  className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors text-text-secondary hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <MaturityToggles data={data} selected={selected} toggle={toggle} />
            <TreasuryChartContent data={data} selected={selected} months={modalMonths} height={500} />
          </div>
        </div>
      )}
    </>
  );
}
