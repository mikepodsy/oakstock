"use client";

import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryData {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
}

export function PortfolioSummaryCards({
  data,
  loading,
}: {
  data: SummaryData | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border-primary bg-bg-secondary p-5"
          >
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Portfolio Value",
      value: formatCurrency(data.totalValue),
      sub: null,
      bgClass: "",
      colorClass: "text-text-primary",
    },
    {
      label: "Total Gain/Loss",
      value: formatCurrency(data.totalGainLoss),
      sub: formatPercent(data.totalGainLossPercent),
      bgClass:
        data.totalGainLoss >= 0 ? "bg-green-muted/30" : "bg-red-muted/30",
      colorClass:
        data.totalGainLoss >= 0 ? "text-green-primary" : "text-red-primary",
    },
    {
      label: "Day Change",
      value: formatCurrency(data.totalDayChange),
      sub: formatPercent(data.totalDayChangePercent),
      bgClass:
        data.totalDayChange >= 0 ? "bg-green-muted/30" : "bg-red-muted/30",
      colorClass:
        data.totalDayChange >= 0 ? "text-green-primary" : "text-red-primary",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border border-border-primary bg-bg-secondary p-5 ${card.bgClass}`}
        >
          <p className="text-xs text-text-secondary mb-1">{card.label}</p>
          <p className={`text-2xl font-financial ${card.colorClass}`}>
            {card.value}
          </p>
          {card.sub && (
            <p className={`text-sm font-financial mt-1 ${card.colorClass}`}>
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
