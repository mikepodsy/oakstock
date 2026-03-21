"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import {
  mergeHoldingWithQuote,
  portfolioTotals,
  totalShares,
  totalCost,
} from "@/utils/calculations";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { PerformanceSummaryBar } from "@/components/portfolio/PerformanceSummaryBar";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AddHoldingModal } from "@/components/portfolio/AddHoldingModal";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { AllocationDonut } from "@/components/charts/AllocationDonut";
import { SectorBreakdown } from "@/components/charts/SectorBreakdown";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.id as string;
  const [period, setPeriod] = useState("1y");

  const portfolio = usePortfolioStore((s) =>
    s.portfolios.find((p) => p.id === portfolioId)
  );

  const tickers = useMemo(
    () => portfolio?.holdings.map((h) => h.ticker) ?? [],
    [portfolio?.holdings]
  );

  const { quotes, loading } = useQuotes(tickers);

  const holdingsWithQuotes = useMemo(
    () =>
      portfolio?.holdings.map((h) =>
        mergeHoldingWithQuote(h, quotes[h.ticker])
      ) ?? [],
    [portfolio?.holdings, quotes]
  );

  const summary = useMemo(() => {
    if (holdingsWithQuotes.length === 0) return null;
    return portfolioTotals(holdingsWithQuotes);
  }, [holdingsWithQuotes]);

  // Chart data inputs
  const historyInputs = useMemo(
    () =>
      portfolio?.holdings.map((h) => ({
        ticker: h.ticker,
        shares: totalShares(h.lots),
      })) ?? [],
    [portfolio?.holdings]
  );

  const costBasisTotal = useMemo(
    () =>
      portfolio?.holdings.reduce((sum, h) => sum + totalCost(h.lots), 0) ?? 0,
    [portfolio?.holdings]
  );

  const {
    data: chartData,
    loading: chartLoading,
    error: chartError,
    refetch: retryChart,
  } = usePortfolioHistory(
    historyInputs,
    portfolio?.benchmark ?? "SPY",
    period,
    costBasisTotal
  );

  // Allocation chart data
  const allocationData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ ticker: h.ticker, name: h.name, website: h.website, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  // Sector chart data
  const sectorData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ sector: h.sector, currency: h.currency, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  if (!portfolio) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center">
        <p className="text-text-secondary">Portfolio not found.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => router.push("/")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const existingTickers = portfolio.holdings.map((h) => h.ticker);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PortfolioHeader portfolio={portfolio} />
      <PerformanceSummaryBar data={summary} loading={loading} />

      <PerformanceChart
        data={chartData}
        benchmarkName={portfolio.benchmark ?? "SPY"}
        period={period}
        onPeriodChange={setPeriod}
        loading={chartLoading}
        error={chartError}
        onRetry={retryChart}
      />

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text-primary">Holdings</h2>
        <AddHoldingModal
          portfolioId={portfolio.id}
          existingTickers={existingTickers}
        >
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Holding
          </Button>
        </AddHoldingModal>
      </div>

      <HoldingsTable
        holdings={holdingsWithQuotes}
        portfolioId={portfolio.id}
      />

      <div className="space-y-6 mt-6 max-w-[660px] mx-auto">
        <AllocationDonut
          holdings={allocationData}
          totalValue={summary?.totalValue ?? 0}
        />
        <SectorBreakdown
          holdings={sectorData}
          totalValue={summary?.totalValue ?? 0}
        />
      </div>
    </div>
  );
}
