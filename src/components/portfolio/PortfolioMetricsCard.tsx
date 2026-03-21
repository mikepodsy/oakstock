"use client";

import { useMemo } from "react";
import { Activity, TrendingUp, ShieldCheck } from "lucide-react";
import type { PortfolioChartPoint } from "@/types";
import { calculatePortfolioMetrics } from "@/utils/calculations";

interface PortfolioMetricsCardProps {
  chartData: PortfolioChartPoint[];
  loading: boolean;
}

// Scale config: min, max, market reference value, labels
interface ScaleConfig {
  min: number;
  max: number;
  marketRef: number;
  zones: { label: string; color: string }[];
}

const BETA_SCALE: ScaleConfig = {
  min: 0,
  max: 2,
  marketRef: 1,
  zones: [
    { label: "Defensive", color: "#10b981" },
    { label: "Moderate", color: "#f59e0b" },
    { label: "Aggressive", color: "#f43f5e" },
  ],
};

const SHARPE_SCALE: ScaleConfig = {
  min: -1,
  max: 3,
  marketRef: 1,
  zones: [
    { label: "Poor", color: "#f43f5e" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#10b981" },
    { label: "Excellent", color: "#06b6d4" },
  ],
};

const SORTINO_SCALE: ScaleConfig = {
  min: -1,
  max: 3,
  marketRef: 1,
  zones: [
    { label: "Poor", color: "#f43f5e" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#10b981" },
    { label: "Excellent", color: "#06b6d4" },
  ],
};

function clampPercent(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function MetricScale({
  icon,
  label,
  value,
  scale,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  scale: ScaleConfig;
}) {
  const markerPos = value !== null ? clampPercent(value, scale.min, scale.max) : null;
  const refPos = clampPercent(scale.marketRef, scale.min, scale.max);

  return (
    <div className="p-4 rounded-lg bg-bg-tertiary">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-tertiary">{icon}</span>
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="ml-auto text-sm font-financial tabular-nums text-text-primary">
          {value !== null ? value.toFixed(2) : "—"}
        </span>
      </div>

      {/* Scale bar */}
      <div className="relative">
        {/* Gradient track with zones */}
        <div className="flex h-2 rounded-full overflow-hidden">
          {scale.zones.map((zone, i) => (
            <div
              key={i}
              className="flex-1 opacity-30"
              style={{ backgroundColor: zone.color }}
            />
          ))}
        </div>

        {/* Market reference line */}
        <div
          className="absolute top-0 w-0.5 h-2 bg-text-secondary"
          style={{ left: `${refPos}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute top-3 text-[10px] text-text-tertiary whitespace-nowrap"
          style={{ left: `${refPos}%`, transform: "translateX(-50%)" }}
        >
          Market
        </div>

        {/* Portfolio marker */}
        {markerPos !== null && (
          <>
            <div
              className="absolute -top-1 w-4 h-4 rounded-full border-2 border-bg-tertiary shadow-sm"
              style={{
                left: `${markerPos}%`,
                transform: "translateX(-50%)",
                backgroundColor: getMarkerColor(markerPos, scale),
              }}
            />
            <div
              className="absolute top-3 text-[10px] font-medium whitespace-nowrap"
              style={{
                left: `${markerPos}%`,
                transform: "translateX(-50%)",
                color: getMarkerColor(markerPos, scale),
              }}
            >
              You
            </div>
          </>
        )}
      </div>

      {/* Zone labels */}
      <div className="flex mt-5">
        {scale.zones.map((zone, i) => (
          <span
            key={i}
            className="flex-1 text-[10px] text-text-tertiary"
            style={{ textAlign: i === 0 ? "left" : i === scale.zones.length - 1 ? "right" : "center" }}
          >
            {zone.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function getMarkerColor(pct: number, scale: ScaleConfig): string {
  const zoneIndex = Math.min(
    Math.floor((pct / 100) * scale.zones.length),
    scale.zones.length - 1
  );
  return scale.zones[zoneIndex].color;
}

export function PortfolioMetricsCard({ chartData, loading }: PortfolioMetricsCardProps) {
  const metrics = useMemo(
    () => calculatePortfolioMetrics(chartData),
    [chartData]
  );

  if (loading || chartData.length < 10) return null;

  return (
    <div className="mt-6">
      <h3 className="font-display text-base text-text-primary mb-4">
        Portfolio Metrics
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MetricScale
          icon={<Activity className="w-4 h-4" />}
          label="Beta"
          value={metrics.beta}
          scale={BETA_SCALE}
        />
        <MetricScale
          icon={<TrendingUp className="w-4 h-4" />}
          label="Sharpe Ratio"
          value={metrics.sharpeRatio}
          scale={SHARPE_SCALE}
        />
        <MetricScale
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Sortino Ratio"
          value={metrics.sortinoRatio}
          scale={SORTINO_SCALE}
        />
      </div>
    </div>
  );
}
