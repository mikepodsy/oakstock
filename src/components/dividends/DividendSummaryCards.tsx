"use client";

import type { DividendHolding, DividendEvent } from "@/types";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface DividendSummaryCardsProps {
  holdings: DividendHolding[];
  upcomingDividends: DividendEvent[];
  loading: boolean;
}

export function DividendSummaryCards({
  holdings,
  upcomingDividends,
  loading,
}: DividendSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
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

  const totalAnnualIncome = holdings.reduce((sum, h) => sum + h.annualIncome, 0);
  const totalMarketValue = holdings.reduce(
    (sum, h) => sum + h.currentPrice * h.totalShares,
    0
  );
  const avgYield = totalMarketValue > 0 ? totalAnnualIncome / totalMarketValue : 0;

  const portfolioStocks = upcomingDividends.filter((e) => e.isPortfolioStock);
  const nextPayment = portfolioStocks.length > 0
    ? `${portfolioStocks[0].date} (${portfolioStocks[0].symbol})`
    : "None scheduled";

  const cards = [
    {
      label: "Est. Annual Income",
      value: formatCurrency(totalAnnualIncome),
      colorClass: "text-green-primary",
    },
    {
      label: "Avg. Portfolio Yield",
      value: formatPercent(avgYield * 100),
      colorClass: "text-text-primary",
    },
    {
      label: "Dividend Holdings",
      value: String(holdings.length),
      colorClass: "text-text-primary",
    },
    {
      label: "Next Payment",
      value: nextPayment,
      colorClass: "text-text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border-primary bg-bg-secondary p-5"
        >
          <p className="text-xs text-text-secondary mb-1">{card.label}</p>
          <p className={`text-2xl font-financial ${card.colorClass}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
