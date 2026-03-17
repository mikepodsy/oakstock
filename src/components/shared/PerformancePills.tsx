"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePerformanceReturns } from "@/hooks/usePerformanceReturns";
import type { PerformancePeriod } from "@/types";

const PERF_PERIODS: PerformancePeriod[] = ["1M", "3M", "YTD", "1Y", "3Y", "5Y"];

export function PerformancePills({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number;
}) {
  const { returns, loading } = usePerformanceReturns(ticker, currentPrice);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {PERF_PERIODS.map((p) => (
          <Skeleton key={p} className="h-7 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {PERF_PERIODS.map((period) => {
        const value = returns?.[period] ?? null;
        if (value === null) {
          return (
            <span
              key={period}
              className="px-3 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-tertiary"
            >
              {period}: —
            </span>
          );
        }
        const isPositive = value >= 0;
        return (
          <span
            key={period}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPositive
                ? "bg-green-muted text-green-primary"
                : "bg-red-muted text-red-primary"
            }`}
          >
            {period}: {value >= 0 ? "+" : ""}
            {value.toFixed(2)}%
          </span>
        );
      })}
    </div>
  );
}
