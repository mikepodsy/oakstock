"use client";

import { useState, useMemo, type ReactNode } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import type { PieData } from "@/components/charts/pie-context";
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

// Matches the previous recharts geometry: 300px box, 75 inner / 140 outer radius.
const CHART_SIZE = 300;
const INNER_RADIUS = 75;
const HOVER_OFFSET = 10;

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const pieData = useMemo<PieData[]>(
    () =>
      chartData.map((item, index) => ({
        label: item.label,
        value: item.value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [chartData]
  );

  if (holdings.length === 0 || totalValue === 0) return null;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setHoveredIndex(null); // slice indexes differ per tab
            }}
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

      <div className="flex flex-col items-center gap-6">
        <PieChart
          data={pieData}
          size={CHART_SIZE}
          innerRadius={INNER_RADIUS}
          hoverOffset={HOVER_OFFSET}
          padAngle={0.01}
          cornerRadius={2}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          {pieData.map((slice, index) => (
            <PieSlice key={slice.label} index={index} />
          ))}
          <PieCenter
            defaultLabel="Total"
            prefix="$"
            formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
          />
        </PieChart>

        {/* Legend list with icons and percentage bars */}
        <div className="w-full space-y-1 max-h-[340px] overflow-y-auto pr-2">
          {chartData.map((item, index) => {
            const isExpanded = expandedGroups.has(item.label);
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return (
              <div key={item.label}>
                {/* Hovering a row highlights its slice in the donut */}
                <div
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`flex items-center gap-2.5 text-sm px-1 rounded-md transition-colors ${
                    hoveredIndex === index ? "bg-bg-tertiary" : ""
                  }`}
                >
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
