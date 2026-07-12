"use client";

import { useMarketData } from "@/hooks/useMarketData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MarketIndicator } from "@/types";

interface MarketStatCardProps {
  title: string;
  symbol: MarketIndicator;
  /** Prefix for the value, e.g. "$" for gold. */
  prefix?: string;
}

function formatValue(value: number, prefix: string): string {
  return `${prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function MarketStatCard({ title, symbol, prefix = "" }: MarketStatCardProps) {
  const { data, loading } = useMarketData(symbol, "5y");
  const value = data?.currentValue ?? null;
  const change = data?.change ?? null;
  const prev = data?.previousValue ?? null;
  const pct = change !== null && prev ? (change / prev) * 100 : null;

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  const up = change !== null && change >= 0;
  const changeColor = up ? "text-green-primary" : "text-red-primary";

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <h3 className="text-sm font-display text-text-primary">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-financial text-3xl tabular-nums text-text-primary">
          {value !== null ? formatValue(value, prefix) : "—"}
        </span>
      </div>
      {change !== null && (
        <p className={cn("mt-1 text-xs font-medium tabular-nums", changeColor)}>
          {up ? "+" : ""}
          {change.toFixed(2)}
          {pct !== null && ` (${up ? "+" : ""}${pct.toFixed(2)}%)`}
        </p>
      )}
    </div>
  );
}
