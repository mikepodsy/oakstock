"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

function SectorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { sector: string; value: number; percent: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.sector}</p>
      <p className="text-xs text-text-secondary">{data.percent.toFixed(1)}%</p>
    </div>
  );
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

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="font-display text-base text-text-primary mb-4 text-center">
        Sectors
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
                dataKey="value"
                nameKey="sector"
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
              <Tooltip content={<SectorTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div className="min-w-[140px] space-y-2 max-h-[280px] overflow-y-auto">
          {chartData.map((item, index) => (
            <div key={item.sector} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-text-primary font-financial truncate">
                {item.sector}
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
