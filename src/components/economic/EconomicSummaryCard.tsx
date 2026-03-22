"use client";

import type { EconomicIndicatorData } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EconomicSummaryCardProps {
  data: EconomicIndicatorData | null;
  loading: boolean;
}

function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "Index") return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EconomicSummaryCard({ data, loading }: EconomicSummaryCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (!data) return null;

  const change = data.change ?? 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isNeutral
    ? "text-text-tertiary"
    : isPositive
      ? "text-green-primary"
      : "text-red-primary";

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <p className="text-xs text-text-secondary mb-1">{data.name}</p>
      <p className="text-2xl font-financial text-text-primary mb-2">
        {data.currentValue !== null ? formatValue(data.currentValue, data.unit) : "N/A"}
      </p>
      {data.change !== null && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          <span>
            {isPositive ? "+" : ""}
            {formatValue(data.change, data.unit)} vs prior
          </span>
        </div>
      )}
    </div>
  );
}
