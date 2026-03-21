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
    <div className="max-w-2xl mx-auto">
      <h3 className="font-display text-base text-text-primary mb-4 text-center">
        Allocation
      </h3>
      <div className="flex items-center justify-center gap-10">
        <div className="w-[280px] h-[280px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                dataKey="marketValue"
                nameKey="ticker"
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
                className="text-base font-financial"
                fill="var(--text-primary)"
              >
                {formatCurrency(totalValue)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div className="min-w-[140px] space-y-2 max-h-[280px] overflow-y-auto">
          {chartData.map((item, index) => (
            <div key={item.ticker} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-text-primary font-financial truncate">
                {item.ticker}
              </span>
              <span className="ml-auto text-text-secondary font-financial flex-shrink-0">
                {item.percent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
