"use client";

import { useMemo } from "react";
import { Activity, TrendingUp, ShieldCheck } from "lucide-react";
import type { PortfolioChartPoint } from "@/types";
import { calculatePortfolioMetrics } from "@/utils/calculations";

interface PortfolioMetricsCardProps {
  chartData: PortfolioChartPoint[];
  loading: boolean;
}

function MetricItem({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-tertiary">
      <div className="flex-shrink-0 text-text-tertiary mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-text-tertiary">{label}</p>
        <p className="text-lg font-financial text-text-primary">{value}</p>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function PortfolioMetricsCard({ chartData, loading }: PortfolioMetricsCardProps) {
  const metrics = useMemo(
    () => calculatePortfolioMetrics(chartData),
    [chartData]
  );

  if (loading || chartData.length < 10) return null;

  const fmt = (v: number | null) => (v !== null ? v.toFixed(2) : "—");

  return (
    <div>
      <h3 className="font-display text-base text-text-primary mb-4">
        Portfolio Metrics
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MetricItem
          icon={<Activity className="w-4 h-4" />}
          label="Beta"
          value={fmt(metrics.beta)}
          description={
            metrics.beta !== null
              ? metrics.beta > 1
                ? "More volatile than the market"
                : metrics.beta < 1
                  ? "Less volatile than the market"
                  : "Moves with the market"
              : "Insufficient data"
          }
        />
        <MetricItem
          icon={<TrendingUp className="w-4 h-4" />}
          label="Sharpe Ratio"
          value={fmt(metrics.sharpeRatio)}
          description={
            metrics.sharpeRatio !== null
              ? metrics.sharpeRatio >= 1
                ? "Good risk-adjusted return"
                : metrics.sharpeRatio >= 0
                  ? "Positive but modest return per unit risk"
                  : "Underperforming risk-free rate"
              : "Insufficient data"
          }
        />
        <MetricItem
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Sortino Ratio"
          value={fmt(metrics.sortinoRatio)}
          description={
            metrics.sortinoRatio !== null
              ? metrics.sortinoRatio >= 1
                ? "Good downside risk-adjusted return"
                : metrics.sortinoRatio >= 0
                  ? "Positive return vs downside risk"
                  : "Downside risk exceeds returns"
              : "Insufficient data"
          }
        />
      </div>
    </div>
  );
}
