"use client";

import { MARKET_INDICES } from "@/utils/constants";
import { useQuotes } from "@/hooks/useQuotes";
import { Skeleton } from "@/components/ui/skeleton";

const indexTickers = MARKET_INDICES.map((i) => i.ticker);

export function MarketOverviewBar() {
  const { quotes, loading } = useQuotes(indexTickers);

  return (
    <div className="h-10 bg-bg-tertiary border-b border-border-primary flex items-center px-6 gap-8 overflow-x-auto">
      {MARKET_INDICES.map(({ ticker, name }) => {
        const quote = quotes[ticker];

        if (loading && !quote) {
          return (
            <div key={ticker} className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-secondary">{name}</span>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          );
        }

        if (!quote) return null;

        const isPositive = quote.dayChangePercent >= 0;

        return (
          <div key={ticker} className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-secondary">{name}</span>
            <span className="text-xs font-financial text-text-primary">
              {quote.currentPrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-xs font-financial ${
                isPositive ? "text-green-primary" : "text-red-primary"
              }`}
            >
              {isPositive ? "+" : ""}
              {quote.dayChangePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
