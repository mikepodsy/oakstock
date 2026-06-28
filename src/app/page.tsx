"use client";

import { useMemo, useState } from "react";
import { TreeDeciduous, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import {
  mergeHoldingWithQuote,
  portfolioTotals,
  totalShares,
  totalCost,
} from "@/utils/calculations";
import { CreatePortfolioDialog } from "@/components/dashboard/CreatePortfolioDialog";
import { PortfolioSummaryCards } from "@/components/dashboard/PortfolioSummaryCards";
import { DailyBrief } from "@/components/dashboard/DailyBrief";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { DEFAULT_BENCHMARKS } from "@/utils/constants";

const BENCHMARK_OPTIONS = DEFAULT_BENCHMARKS.map((b) => ({
  label: b,
  value: b,
}));

export default function DashboardPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const [period, setPeriod] = useState("1y");
  const [benchmark, setBenchmark] = useState("SPY");

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

  // Combined chart data: all holdings from all portfolios
  const combinedHistoryInputs = useMemo(
    () =>
      portfolios.flatMap((p) =>
        p.holdings.map((h) => ({
          ticker: h.ticker,
          shares: totalShares(h.lots),
        }))
      ),
    [portfolios]
  );

  const combinedCostBasis = useMemo(
    () =>
      portfolios.reduce(
        (sum, p) =>
          sum + p.holdings.reduce((s, h) => s + totalCost(h.lots), 0),
        0
      ),
    [portfolios]
  );

  const { data: combinedChartData, loading: chartLoading } =
    usePortfolioHistory(
      combinedHistoryInputs,
      benchmark,
      period,
      combinedCostBasis
    );

  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-104px)] px-6 text-center">
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
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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

      <PerformanceChart
        data={combinedChartData}
        benchmarkName={benchmark}
        period={period}
        onPeriodChange={setPeriod}
        loading={chartLoading}
        title="Oakstock Performance"
        benchmarkOptions={BENCHMARK_OPTIONS}
        onBenchmarkChange={setBenchmark}
      />

      <DailyBrief />
    </div>
  );
}
