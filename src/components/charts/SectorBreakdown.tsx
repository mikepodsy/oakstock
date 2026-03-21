"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

  const maxPercent = chartData[0]?.percent ?? 100;

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Sectors
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
                dataKey="value"
                nameKey="sector"
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
              <Tooltip content={<SectorTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list with percentage bars */}
        <div className="min-w-[240px] space-y-2.5 max-h-[320px] overflow-y-auto pr-2">
          {chartData.map((item, index) => (
            <div key={item.sector} className="flex items-center gap-2.5 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-text-primary font-financial truncate min-w-0">
                {item.sector}
              </span>
              <span className="text-text-primary font-financial flex-shrink-0 tabular-nums w-[48px] text-right">
                {item.percent.toFixed(1)}%
              </span>
              <div className="w-[80px] h-2 bg-bg-tertiary rounded-full flex-shrink-0 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.percent / maxPercent) * 100}%`,
                    backgroundColor:
                      CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
