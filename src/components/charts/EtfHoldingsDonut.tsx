"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import type { PieData } from "@/components/charts/pie-context";
import { formatDate } from "@/utils/formatters";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import type { EtfHoldingsResult } from "@/lib/edgar/nport";

const CHART_COLORS = [
  "#7c3aed", "#06b6d4", "#10b981", "#f43f5e", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#14b8a6", "#ec4899", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#22d3ee", "#a78bfa",
  "#fb923c", "#4ade80", "#f472b6",
];
const OTHER_COLOR = "#64748b"; // slate — the aggregated remainder slice

// A broad ETF holds 500+ names; only the largest are worth their own slice.
const TOP_N = 18;

// Matches the previous recharts geometry: 300px box, 75 inner / 140 outer radius.
const CHART_SIZE = 300;
const INNER_RADIUS = 75;
const HOVER_OFFSET = 10;

interface Slice {
  name: string;
  ticker: string | null;
  valUSD: number;
  pct: number;
  isOther: boolean;
}

function sliceColor(index: number, isOther: boolean): string {
  return isOther ? OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length];
}

export function EtfHoldingsDonut({ data }: { data: EtfHoldingsResult }) {
  const { holdings, totalValue, holdingsCount, asOf } = data;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const slices = useMemo<Slice[]>(() => {
    const top = holdings.slice(0, TOP_N);
    const result: Slice[] = top.map((h) => ({
      name: h.name,
      ticker: h.ticker,
      valUSD: h.valUSD,
      pct: (h.valUSD / totalValue) * 100,
      isOther: false,
    }));

    // "Other" covers every position not shown as its own slice — computed from the
    // filing totals so it stays correct even though the payload is capped.
    const shownValue = top.reduce((sum, h) => sum + h.valUSD, 0);
    const otherValue = totalValue - shownValue;
    const otherCount = holdingsCount - top.length;
    if (otherCount > 0 && otherValue > 0) {
      result.push({
        name: `Other (${otherCount} holdings)`,
        ticker: null,
        valUSD: otherValue,
        pct: (otherValue / totalValue) * 100,
        isOther: true,
      });
    }
    return result;
  }, [holdings, totalValue, holdingsCount]);

  // The center readout labels by ticker where there is one — full fund names
  // are far too wide for the hole.
  const pieData = useMemo<PieData[]>(
    () =>
      slices.map((slice, index) => ({
        label: slice.ticker ?? slice.name,
        value: slice.valUSD,
        color: sliceColor(index, slice.isOther),
      })),
    [slices]
  );

  if (holdings.length === 0 || totalValue === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-display text-base text-text-primary">Holdings</h3>
        {asOf && (
          <span className="text-xs text-text-secondary">
            {holdingsCount} positions · as of {formatDate(asOf)} · SEC NPORT-P
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-6">
        <PieChart
          data={pieData}
          size={CHART_SIZE}
          innerRadius={INNER_RADIUS}
          hoverOffset={HOVER_OFFSET}
          padAngle={0.01}
          cornerRadius={2}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          {pieData.map((slice, index) => (
            <PieSlice key={`${slice.label}-${index}`} index={index} />
          ))}
          <PieCenter
            defaultLabel="Net assets"
            prefix="$"
            formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
          />
        </PieChart>

        {/* Legend — three across to keep the list compact */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {slices.map((item, index) => {
            const color = sliceColor(index, item.isOther);
            // Small logo for named holdings; a color-filled tile otherwise. The
            // border keeps the pie ↔ legend color mapping.
            const icon = (
              <span
                className="w-6 h-6 rounded-md overflow-hidden border flex-shrink-0 flex items-center justify-center bg-white"
                style={{ borderColor: color }}
              >
                {item.ticker ? (
                  <CompanyLogo
                    ticker={item.ticker}
                    className="w-full h-full rounded-[3px]"
                    textClassName="text-[8px]"
                  />
                ) : (
                  <span className="w-full h-full" style={{ backgroundColor: color }} />
                )}
              </span>
            );
            const pct = (
              <span className="ml-auto text-sm text-text-primary font-financial flex-shrink-0 tabular-nums">
                {item.pct.toFixed(2)}%
              </span>
            );
            // Hovering a row highlights its slice in the donut.
            const rowProps = {
              onMouseEnter: () => setHoveredIndex(index),
              onMouseLeave: () => setHoveredIndex(null),
              className: `flex items-center gap-2.5 py-1 px-1 rounded-md min-w-0 transition-colors ${
                hoveredIndex === index ? "bg-bg-tertiary" : ""
              }`,
            };
            return item.ticker ? (
              <Link
                key={`${item.name}-${index}`}
                href={`/stock/${encodeURIComponent(item.ticker)}`}
                {...rowProps}
                className={`${rowProps.className} group`}
              >
                {icon}
                <span className="text-sm text-text-primary font-financial truncate min-w-0 group-hover:text-green-primary group-hover:underline">
                  {item.name}
                </span>
                {pct}
              </Link>
            ) : (
              <div key={`${item.name}-${index}`} {...rowProps}>
                {icon}
                <span className="text-sm text-text-primary font-financial truncate min-w-0">
                  {item.name}
                </span>
                {pct}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
