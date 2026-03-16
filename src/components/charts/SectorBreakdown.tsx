"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SectorBreakdownProps {
  holdings: { sector: string | undefined; marketValue: number }[];
  totalValue: number;
}

export function SectorBreakdown({
  holdings,
  totalValue,
}: SectorBreakdownProps) {
  if (holdings.length === 0 || totalValue === 0) return null;

  // Group by sector
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? "Unknown";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }

  const chartData = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      percent: (value / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  const chartHeight = Math.max(chartData.length * 40, 120);

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Sectors
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="sector"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={true}>
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v) => `${Number(v).toFixed(1)}%`}
              style={{
                fill: "var(--text-secondary)",
                fontSize: 12,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
