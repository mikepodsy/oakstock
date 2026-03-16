"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Portfolio, QuoteData } from "@/types";
import { totalShares, totalCost } from "@/utils/calculations";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { DeletePortfolioDialog } from "./DeletePortfolioDialog";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/Sparkline";

export function PortfolioCard({
  portfolio,
  quotes,
  sparklineData,
}: {
  portfolio: Portfolio;
  quotes: Record<string, QuoteData>;
  sparklineData?: number[];
}) {
  let marketValue = 0;
  let costBasis = 0;

  for (const holding of portfolio.holdings) {
    const quote = quotes[holding.ticker];
    const shares = totalShares(holding.lots);
    const cost = totalCost(holding.lots);
    const price = quote?.currentPrice ?? 0;

    marketValue += shares * price;
    costBasis += cost;
  }

  const gainLoss = marketValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  const hasData = portfolio.holdings.length > 0 && marketValue > 0;

  return (
    <div className="group relative rounded-xl border border-border-primary bg-bg-secondary p-5 transition-all duration-150 hover:border-oak-300/40 hover:scale-[1.005]">
      <Link
        href={`/portfolio/${portfolio.id}`}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">View {portfolio.name}</span>
      </Link>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-base text-text-primary">
            {portfolio.name}
          </h3>
          {portfolio.description && (
            <p className="text-xs text-text-tertiary mt-0.5">
              {portfolio.description}
            </p>
          )}
        </div>
        <DeletePortfolioDialog
          portfolioId={portfolio.id}
          portfolioName={portfolio.name}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            className="relative z-20 text-text-tertiary hover:text-red-primary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </DeletePortfolioDialog>
      </div>

      {hasData ? (
        <>
          <p className="text-xl font-financial text-text-primary mb-1">
            {formatCurrency(marketValue)}
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-financial ${gainLoss >= 0 ? "text-green-primary" : "text-red-primary"}`}
            >
              {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-tertiary">
              {portfolio.holdings.length} holding
              {portfolio.holdings.length !== 1 ? "s" : ""}
            </p>
            {sparklineData && <Sparkline data={sparklineData} />}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-tertiary">
          {portfolio.holdings.length === 0
            ? "No holdings yet"
            : "Loading prices..."}
        </p>
      )}
    </div>
  );
}
