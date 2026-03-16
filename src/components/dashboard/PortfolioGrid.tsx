"use client";

import type { Portfolio, QuoteData } from "@/types";
import { PortfolioCard } from "./PortfolioCard";

export function PortfolioGrid({
  portfolios,
  quotes,
  sparklineMap,
}: {
  portfolios: Portfolio[];
  quotes: Record<string, QuoteData>;
  sparklineMap?: Record<string, number[]>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {portfolios.map((portfolio) => (
        <PortfolioCard
          key={portfolio.id}
          portfolio={portfolio}
          quotes={quotes}
          sparklineData={sparklineMap?.[portfolio.id]}
        />
      ))}
    </div>
  );
}
