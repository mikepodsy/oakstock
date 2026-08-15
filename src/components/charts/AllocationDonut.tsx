"use client";

import { useMemo, useState } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import type { PieData } from "@/components/charts/pie-context";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { Wallet } from "lucide-react";

const CHART_COLORS = [
  "#7c3aed", "#06b6d4", "#10b981", "#f43f5e", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#14b8a6", "#ec4899", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#22d3ee", "#a78bfa",
];

// Matches the previous recharts geometry: 300px box, 75 inner / 140 outer radius.
const CHART_SIZE = 300;
const INNER_RADIUS = 75;
const HOVER_OFFSET = 10;

interface AllocationDonutProps {
  holdings: { ticker: string; name: string; website?: string; marketValue: number }[];
  totalValue: number;
  /** Uninvested cash, drawn as its own slice. `totalValue` must already include it. */
  cash?: number;
}

export function AllocationDonut({
  holdings,
  totalValue,
  cash = 0,
}: AllocationDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const items = holdings
      .filter((h) => h.marketValue > 0)
      .map((h) => ({
        ticker: h.ticker,
        name: h.name,
        website: h.website as string | undefined,
        marketValue: h.marketValue,
        isCash: false,
      }));

    if (cash > 0) {
      items.push({
        ticker: "Cash",
        name: "Uninvested cash",
        website: undefined,
        marketValue: cash,
        isCash: true,
      });
    }

    return items
      .map((item) => ({ ...item, pct: (item.marketValue / totalValue) * 100 }))
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [holdings, totalValue, cash]);

  // The center readout labels by ticker — the full name is too wide for the hole.
  const pieData = useMemo<PieData[]>(
    () =>
      chartData.map((item, index) => ({
        label: item.ticker,
        value: item.marketValue,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [chartData]
  );

  if (chartData.length === 0 || totalValue === 0) return null;

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Allocation
      </h3>
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
            <PieSlice key={slice.label} index={index} />
          ))}
          <PieCenter
            defaultLabel="Total"
            prefix="$"
            formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
          />
        </PieChart>

        {/* Legend list with logos — hovering a row highlights its slice */}
        <div className="w-full space-y-1 max-h-[340px] overflow-y-auto pr-2">
          {chartData.map((item, index) => (
            <div
              key={item.ticker}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center gap-2.5 py-1 rounded-md px-1 transition-colors ${
                hoveredIndex === index ? "bg-bg-tertiary" : ""
              }`}
            >
              <div className="flex-shrink-0 [&_img]:!w-7 [&_img]:!h-7 [&_img]:!rounded-md [&_div]:!w-7 [&_div]:!h-7 [&_div]:!rounded-md [&_div]:!text-xs">
                {item.isCash ? (
                  // Cash has no company behind it, so skip the logo lookup.
                  <div className="w-7 h-7 rounded-md bg-bg-tertiary flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-text-secondary" />
                  </div>
                ) : (
                  <CompanyLogo ticker={item.ticker} website={item.website} />
                )}
              </div>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-sm text-text-primary font-financial font-medium flex-shrink-0">
                {item.ticker}
              </span>
              <span className="text-sm text-text-secondary font-financial truncate min-w-0">
                {item.name}
              </span>
              <span className="ml-auto text-sm text-text-primary font-financial flex-shrink-0 tabular-nums">
                {item.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
