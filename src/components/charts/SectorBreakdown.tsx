"use client";

import { useState, useMemo, type ReactNode } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Cpu, ShoppingCart, Factory, Stethoscope, Banknote,
  Zap, MessageSquare, Building2, Pickaxe, Wheat,
  Globe, HelpCircle, Landmark, DollarSign, Coins,
} from "lucide-react";

const CHART_COLORS = [
  "#7c3aed", "#06b6d4", "#10b981", "#f43f5e", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#14b8a6", "#ec4899", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#22d3ee", "#a78bfa",
];

const SECTOR_ICONS: Record<string, ReactNode> = {
  "Technology": <Cpu className="w-4 h-4" />,
  "Information Technology": <Cpu className="w-4 h-4" />,
  "Consumer Discretionary": <ShoppingCart className="w-4 h-4" />,
  "Consumer Cyclical": <ShoppingCart className="w-4 h-4" />,
  "Consumer Staples": <Wheat className="w-4 h-4" />,
  "Consumer Defensive": <Wheat className="w-4 h-4" />,
  "Industrials": <Factory className="w-4 h-4" />,
  "Healthcare": <Stethoscope className="w-4 h-4" />,
  "Financials": <Banknote className="w-4 h-4" />,
  "Financial Services": <Banknote className="w-4 h-4" />,
  "Energy": <Zap className="w-4 h-4" />,
  "Communication Services": <MessageSquare className="w-4 h-4" />,
  "Real Estate": <Building2 className="w-4 h-4" />,
  "Materials": <Pickaxe className="w-4 h-4" />,
  "Basic Materials": <Pickaxe className="w-4 h-4" />,
  "Utilities": <Landmark className="w-4 h-4" />,
  "Cash": <Coins className="w-4 h-4" />,
  "Unknown": <HelpCircle className="w-4 h-4" />,
};

const CURRENCY_ICONS: Record<string, ReactNode> = {
  "USD": <DollarSign className="w-4 h-4" />,
  "CAD": <DollarSign className="w-4 h-4" />,
};

type TabKey = "sectors" | "currencies";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sectors", label: "Sectors" },
  { key: "currencies", label: "Currencies" },
];

interface SectorBreakdownProps {
  holdings: { sector: string | undefined; currency: string; marketValue: number }[];
  totalValue: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { label: string; value: number; percent: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.label}</p>
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

function groupBy(
  holdings: SectorBreakdownProps["holdings"],
  totalValue: number,
  key: TabKey
) {
  const map = new Map<string, number>();
  for (const h of holdings) {
    let group: string;
    if (key === "sectors") {
      group = h.sector ?? "Unknown";
    } else {
      group = h.currency ?? "Unknown";
    }
    map.set(group, (map.get(group) ?? 0) + h.marketValue);
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      value,
      percent: (value / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

function getIcon(tab: TabKey, label: string): ReactNode {
  if (tab === "sectors") return SECTOR_ICONS[label] ?? <Globe className="w-4 h-4" />;
  if (tab === "currencies") return CURRENCY_ICONS[label] ?? <Coins className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

export function SectorBreakdown({
  holdings,
  totalValue,
}: SectorBreakdownProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("sectors");

  const chartData = useMemo(
    () => groupBy(holdings, totalValue, activeTab),
    [holdings, totalValue, activeTab]
  );

  if (holdings.length === 0 || totalValue === 0) return null;

  const maxPercent = chartData[0]?.percent ?? 100;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
                nameKey="label"
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
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list with icons and percentage bars */}
        <div className="min-w-[260px] space-y-2 max-h-[340px] overflow-y-auto pr-2">
          {chartData.map((item, index) => (
            <div key={item.label} className="flex items-center gap-2.5 text-sm">
              <span
                className="flex-shrink-0 text-text-secondary"
              >
                {getIcon(activeTab, item.label)}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-text-primary font-financial truncate min-w-0">
                {item.label}
              </span>
              <span className="text-text-primary font-financial flex-shrink-0 tabular-nums w-[48px] text-right">
                {item.percent.toFixed(1)}%
              </span>
              <div className="w-[80px] h-2 bg-bg-tertiary rounded-full flex-shrink-0 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.percent / maxPercent) * 100}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
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
