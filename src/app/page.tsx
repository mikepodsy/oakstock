"use client";

import { useMemo } from "react";
import { TreeDeciduous, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { mergeHoldingWithQuote, portfolioTotals } from "@/utils/calculations";
import { CreatePortfolioDialog } from "@/components/dashboard/CreatePortfolioDialog";
import { PortfolioSummaryCards } from "@/components/dashboard/PortfolioSummaryCards";
import { DailyBrief } from "@/components/dashboard/DailyBrief";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { ChartGrid } from "@/components/dashboard/grid/ChartGrid";

export default function DashboardPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);

  // Collect all unique tickers across all portfolios
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) {
        set.add(h.ticker);
      }
    }
    return Array.from(set);
  }, [portfolios]);

  const { quotes, loading } = useQuotes(allTickers);

  // Compute summary across all portfolios
  const summary = useMemo(() => {
    if (allTickers.length === 0) return null;
    const allHoldings = portfolios.flatMap((p) =>
      p.holdings.map((h) => mergeHoldingWithQuote(h, quotes[h.ticker]))
    );
    return portfolioTotals(allHoldings);
  }, [portfolios, quotes, allTickers.length]);

  // Charts don't depend on owning a portfolio, so the workspace renders in the
  // empty state too — just without the portfolio-derived cards.
  if (portfolios.length === 0) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <TreeDeciduous className="h-16 w-16 text-oak-300 mb-4 opacity-60" />
            <h1 className="font-display text-2xl text-text-primary mb-2">
              Plant your first portfolio
            </h1>
            <p className="text-text-secondary text-sm mb-6 max-w-sm">
              Start tracking your investments with Oakstock. Create a portfolio to
              get started.
            </p>
            <CreatePortfolioDialog>
              <Button size="lg" className="font-semibold">
                Create Portfolio
              </Button>
            </CreatePortfolioDialog>
          </div>
        </div>

        <ChartGrid />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-text-primary">Dashboard</h1>
          <CreatePortfolioDialog>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Portfolio
            </Button>
          </CreatePortfolioDialog>
        </div>

        <PortfolioSummaryCards data={summary} loading={loading} />

        <MarketOverview />

        <DailyBrief />
      </div>

      {/* Full-bleed: the grid wants the whole viewport width, not the 7xl column. */}
      <ChartGrid />
    </div>
  );
}
