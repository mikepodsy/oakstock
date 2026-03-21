"use client";

import { useState, useMemo, type ReactNode } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Cpu, ShoppingCart, Factory, Stethoscope, Banknote,
  Zap, MessageSquare, Building2, Pickaxe, Wheat,
  Globe, HelpCircle, Landmark, DollarSign, Coins,
  ChevronDown,
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

interface HoldingItem {
  ticker: string;
  name: string;
  sector: string | undefined;
  currency: string;
  marketValue: number;
}

interface SectorBreakdownProps {
  holdings: HoldingItem[];
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
    payload: { label: string; value: number; pct: number };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs font-financial text-text-primary">{data.label}</p>
      <p className="text-xs text-text-secondary">{data.pct.toFixed(1)}%</p>
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
  holdings: HoldingItem[],
  totalValue: number,
  key: TabKey
) {
  const valueMap = new Map<string, number>();
  const holdingsMap = new Map<string, { ticker: string; name: string; marketValue: number }[]>();
  for (const h of holdings) {
    const group = key === "sectors" ? (h.sector ?? "Unknown") : (h.currency ?? "Unknown");
    valueMap.set(group, (valueMap.get(group) ?? 0) + h.marketValue);
    const list = holdingsMap.get(group) ?? [];
    list.push({ ticker: h.ticker, name: h.name, marketValue: h.marketValue });
    holdingsMap.set(group, list);
  }

  return Array.from(valueMap.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: (value / totalValue) * 100,
      holdings: (holdingsMap.get(label) ?? []).sort((a, b) => b.marketValue - a.marketValue),
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const chartData = useMemo(
    () => groupBy(holdings, totalValue, activeTab),
    [holdings, totalValue, activeTab]
  );

  if (holdings.length === 0 || totalValue === 0) return null;

  const maxPct = chartData[0]?.pct ?? 100;

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
        <div className="w-[280px] flex-shrink-0 space-y-1 max-h-[340px] overflow-y-auto pr-2">
          {chartData.map((item, index) => {
            const isExpanded = expandedGroups.has(item.label);
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return (
              <div key={item.label}>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="flex-shrink-0 text-text-secondary">
                    {getIcon(activeTab, item.label)}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-text-primary font-financial truncate min-w-0">
                    {item.label}
                  </span>
                  <span className="text-text-primary font-financial flex-shrink-0 tabular-nums w-[48px] text-right">
                    {item.pct.toFixed(1)}%
                  </span>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors p-0.5"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-[26px] mt-1 mb-1 space-y-0.5">
                    {item.holdings.map((h) => (
                      <div
                        key={h.ticker}
                        className="flex items-center gap-2 text-xs text-text-secondary font-financial"
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: 0.5 }} />
                        <span className="font-medium text-text-primary flex-shrink-0">{h.ticker}</span>
                        <span className="truncate min-w-0">{h.name}</span>
                        <span className="ml-auto flex-shrink-0 tabular-nums">
                          {((h.marketValue / totalValue) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
