"use client";

import { useMemo, useState, useEffect } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuotes } from "@/hooks/useQuotes";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import {
  mergeHoldingWithQuote,
  portfolioTotals,
  totalShares,
  totalCost,
} from "@/utils/calculations";
import { PerformanceSummaryBar } from "@/components/portfolio/PerformanceSummaryBar";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AddHoldingModal } from "@/components/portfolio/AddHoldingModal";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { AllocationDonut } from "@/components/charts/AllocationDonut";
import { SectorBreakdown } from "@/components/charts/SectorBreakdown";
import { PortfolioMetricsCard } from "@/components/portfolio/PortfolioMetricsCard";
import { CreatePortfolioDialog } from "@/components/dashboard/CreatePortfolioDialog";
import { DeletePortfolioDialog } from "@/components/dashboard/DeletePortfolioDialog";
import { BenchmarkSelect } from "@/components/shared/BenchmarkSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen, ChevronDown } from "lucide-react";

export default function PortfolioPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const updatePortfolio = usePortfolioStore((s) => s.updatePortfolio);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState("1y");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Auto-select first portfolio
  useEffect(() => {
    if (portfolios.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !portfolios.find((p) => p.id === selectedId)) {
      setSelectedId(portfolios[0].id);
    }
  }, [portfolios, selectedId]);

  const portfolio = portfolios.find((p) => p.id === selectedId) ?? null;

  // Sync name value when portfolio changes
  useEffect(() => {
    if (portfolio) setNameValue(portfolio.name);
  }, [portfolio?.id, portfolio?.name]);

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

  const allocationData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ ticker: h.ticker, name: h.name, website: h.website, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  const sectorData = useMemo(
    () =>
      holdingsWithQuotes
        .filter((h) => h.marketValue > 0)
        .map((h) => ({ ticker: h.ticker, name: h.name, sector: h.sector, currency: h.currency, marketValue: h.marketValue })),
    [holdingsWithQuotes]
  );

  function saveName() {
    if (portfolio && nameValue.trim() && nameValue.trim() !== portfolio.name) {
      updatePortfolio(portfolio.id, { name: nameValue.trim() });
    }
    setEditingName(false);
  }

  // Empty state
  if (portfolios.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-text-primary">Portfolio</h1>
          <CreatePortfolioDialog>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Portfolio
            </Button>
          </CreatePortfolioDialog>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-280px)] px-6 text-center">
          <FolderOpen className="h-16 w-16 text-oak-300 mb-4 opacity-60" />
          <h2 className="font-display text-2xl text-text-primary mb-2">
            No portfolios yet
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-sm">
            Create a portfolio to start tracking your investments.
          </p>
          <CreatePortfolioDialog>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Portfolio
            </Button>
          </CreatePortfolioDialog>
        </div>
      </div>
    );
  }

  const existingTickers = portfolio?.holdings.map((h) => h.ticker) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-text-primary">Portfolio</h1>
        <CreatePortfolioDialog>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Portfolio
          </Button>
        </CreatePortfolioDialog>
      </div>

      {/* Portfolio Selector */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="appearance-none rounded-lg border border-border-primary bg-bg-tertiary px-4 py-2 pr-8 text-sm font-medium text-text-primary outline-none cursor-pointer"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
        </div>
      </div>

      {portfolio && (
        <>
          {/* Portfolio Name + Controls */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {editingName ? (
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setNameValue(portfolio.name);
                      setEditingName(false);
                    }
                  }}
                  className="font-display text-2xl bg-transparent border-border-primary text-text-primary h-auto py-1 px-2 -ml-2"
                  autoFocus
                />
              ) : (
                <h2
                  className="font-display text-2xl text-text-primary cursor-pointer hover:text-green-primary transition-colors"
                  onClick={() => setEditingName(true)}
                  title="Click to edit"
                >
                  {portfolio.name}
                </h2>
              )}
              {portfolio.description && (
                <p className="text-sm text-text-secondary mt-1">
                  {portfolio.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-text-tertiary">Benchmark:</span>
                <BenchmarkSelect
                  value={portfolio.benchmark}
                  onChange={(value) =>
                    updatePortfolio(portfolio.id, {
                      benchmark: value,
                    })
                  }
                  className="text-xs rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-text-primary outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AddHoldingModal
                portfolioId={portfolio.id}
                existingTickers={existingTickers}
              >
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Holding
                </Button>
              </AddHoldingModal>
              <DeletePortfolioDialog
                portfolioId={portfolio.id}
                portfolioName={portfolio.name}
              >
                <Button variant="destructive" size="sm">
                  Delete
                </Button>
              </DeletePortfolioDialog>
            </div>
          </div>

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
            <h2 className="font-display text-lg text-text-primary">
              Holdings
            </h2>
          </div>

          <HoldingsTable
            holdings={holdingsWithQuotes}
            portfolioId={portfolio.id}
          />

          <PortfolioMetricsCard
            chartData={chartData}
            loading={chartLoading}
          />

          {/* Allocation & Sectors below holdings */}
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
        </>
      )}
    </div>
  );
}
