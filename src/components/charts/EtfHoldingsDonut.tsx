"use client";

import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompactNumber, formatDate } from "@/utils/formatters";
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

interface Slice {
  name: string;
  ticker: string | null;
  valUSD: number;
  pct: number;
  isOther: boolean;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Slice }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.name}</p>
      <p className="text-xs text-text-secondary">
        ${formatCompactNumber(data.valUSD)} ({data.pct.toFixed(2)}%)
      </p>
    </div>
  );
}

function PieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  if (percent < 0.03) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-financial"
      fill="white"
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

function sliceColor(index: number, isOther: boolean): string {
  return isOther ? OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length];
}

export function EtfHoldingsDonut({ data }: { data: EtfHoldingsResult }) {
  const { holdings, totalValue, holdingsCount, asOf } = data;
  if (holdings.length === 0 || totalValue === 0) return null;

  const top = holdings.slice(0, TOP_N);

  const slices: Slice[] = top.map((h) => ({
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
    slices.push({
      name: `Other (${otherCount} holdings)`,
      ticker: null,
      valUSD: otherValue,
      pct: (otherValue / totalValue) * 100,
      isOther: true,
    });
  }

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
        <div className="w-[300px] h-[300px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={140}
                dataKey="valUSD"
                nameKey="name"
                label={PieLabel}
                labelLine={false}
                isAnimationActive={true}
                animationDuration={800}
              >
                {slices.map((s, index) => (
                  <Cell key={index} fill={sliceColor(index, s.isOther)} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

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
            return item.ticker ? (
              <Link
                key={`${item.name}-${index}`}
                href={`/stock/${encodeURIComponent(item.ticker)}`}
                className="flex items-center gap-2.5 py-1 min-w-0 group"
              >
                {icon}
                <span className="text-sm text-text-primary font-financial truncate min-w-0 group-hover:text-green-primary group-hover:underline">
                  {item.name}
                </span>
                {pct}
              </Link>
            ) : (
              <div key={`${item.name}-${index}`} className="flex items-center gap-2.5 py-1 min-w-0">
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
