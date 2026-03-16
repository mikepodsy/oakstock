"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/utils/formatters";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface AllocationDonutProps {
  holdings: { ticker: string; marketValue: number }[];
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
    payload: { ticker: string; marketValue: number; percent: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.ticker}</p>
      <p className="text-xs text-text-secondary">
        {formatCurrency(data.marketValue)} ({formatPercent(data.percent)})
      </p>
    </div>
  );
}

function CustomLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  ticker,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  ticker: string;
  percent: number;
}) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-xs font-financial"
      fill="var(--text-secondary)"
    >
      {ticker} {percent.toFixed(0)}%
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
      marketValue: h.marketValue,
      percent: (h.marketValue / totalValue) * 100,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Allocation
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="marketValue"
            nameKey="ticker"
            label={CustomLabel}
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
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-lg font-financial"
            fill="var(--text-primary)"
          >
            {formatCurrency(totalValue)}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
