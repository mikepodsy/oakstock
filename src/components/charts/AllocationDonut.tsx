"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { CompanyLogo } from "@/components/shared/CompanyLogo";

const CHART_COLORS = [
  "#7c3aed", "#06b6d4", "#10b981", "#f43f5e", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#14b8a6", "#ec4899", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#22d3ee", "#a78bfa",
];

interface AllocationDonutProps {
  holdings: { ticker: string; name: string; website?: string; marketValue: number }[];
  totalValue: number;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { ticker: string; name: string; marketValue: number; pct: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">
        {data.ticker} &middot; {data.name}
      </p>
      <p className="text-xs text-text-secondary">
        {formatCurrency(data.marketValue)} ({formatPercent(data.pct)})
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

export function AllocationDonut({
  holdings,
  totalValue,
}: AllocationDonutProps) {
  if (holdings.length === 0 || totalValue === 0) return null;

  const chartData = holdings
    .filter((h) => h.marketValue > 0)
    .map((h) => ({
      ticker: h.ticker,
      name: h.name,
      website: h.website,
      marketValue: h.marketValue,
      pct: (h.marketValue / totalValue) * 100,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Allocation
      </h3>
      <div className="flex items-center justify-center gap-10">
        <div className="w-[320px] h-[320px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={140}
                dataKey="marketValue"
                nameKey="ticker"
                label={PieLabel}
                labelLine={false}
                isAnimationActive={true}
                animationDuration={800}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list with logos */}
        <div className="w-[280px] flex-shrink-0 space-y-1 max-h-[340px] overflow-y-auto pr-2">
          {chartData.map((item, index) => (
            <div key={item.ticker} className="flex items-center gap-2.5 py-1">
              <div className="flex-shrink-0 [&_img]:!w-7 [&_img]:!h-7 [&_img]:!rounded-md [&_div]:!w-7 [&_div]:!h-7 [&_div]:!rounded-md [&_div]:!text-xs">
                <CompanyLogo ticker={item.ticker} website={item.website} />
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
