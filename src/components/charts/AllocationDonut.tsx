"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/utils/formatters";

const CHART_COLORS = [
  "#7c3aed", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#ec4899", // pink
  "#6366f1", // indigo
  "#84cc16", // lime
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#22d3ee", // cyan-light
  "#a78bfa", // violet-light
];

interface AllocationDonutProps {
  holdings: { ticker: string; name: string; marketValue: number }[];
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
    payload: { ticker: string; name: string; marketValue: number; percent: number };
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
        {formatCurrency(data.marketValue)} ({formatPercent(data.percent)})
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
      marketValue: h.marketValue,
      percent: (h.marketValue / totalValue) * 100,
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

        {/* Legend list */}
        <div className="min-w-[200px] space-y-2.5 max-h-[320px] overflow-y-auto pr-2">
          {chartData.map((item, index) => (
            <div key={item.ticker} className="flex items-center gap-2.5 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-text-primary font-financial font-medium flex-shrink-0">
                {item.ticker}
              </span>
              <span className="text-text-secondary font-financial truncate">
                {item.name}
              </span>
              <span className="ml-auto text-text-primary font-financial flex-shrink-0 tabular-nums">
                {item.percent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
