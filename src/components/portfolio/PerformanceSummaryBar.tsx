"use client";

import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface PerformanceData {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
}

export function PerformanceSummaryBar({
  data,
  loading,
  cash = 0,
  cashCurrency = "USD",
}: {
  data: PerformanceData | null;
  loading: boolean;
  /** Uninvested cash. Counts toward current value; never toward gain/loss. */
  cash?: number;
  cashCurrency?: "CAD" | "USD";
}) {
  if (loading || !data) {
    return (
      <div className="flex gap-6 mb-6 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Current Value",
      value: formatCurrency(data.totalValue + cash),
      color: "text-text-primary",
    },
    // Gain/loss below stays holdings-only — cash can't gain or lose.
    ...(cash > 0
      ? [
          {
            label: "Cash",
            value: formatCurrency(cash, cashCurrency),
            color: "text-text-secondary",
          },
        ]
      : []),
    {
      label: "Total Gain/Loss",
      value: formatCurrency(data.totalGainLoss),
      color:
        data.totalGainLoss >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Total Return",
      value: formatPercent(data.totalGainLossPercent),
      color:
        data.totalGainLossPercent >= 0
          ? "text-green-primary"
          : "text-red-primary",
    },
    {
      label: "Day Change",
      value: formatCurrency(data.totalDayChange),
      color:
        data.totalDayChange >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Day %",
      value: formatPercent(data.totalDayChangePercent),
      color:
        data.totalDayChangePercent >= 0
          ? "text-green-primary"
          : "text-red-primary",
    },
  ];

  return (
    <div className="flex gap-6 mb-6 flex-wrap">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-xs text-text-tertiary">{s.label}</p>
          <p className={`text-lg font-financial ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
