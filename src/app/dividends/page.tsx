"use client";

import { useMemo } from "react";
import type { DividendEvent } from "@/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useDividendHoldings } from "@/hooks/useDividendHoldings";
import { useDividendIncome } from "@/hooks/useDividendIncome";
import { useCalendar } from "@/hooks/useCalendar";
import { DividendSummaryCards } from "@/components/dividends/DividendSummaryCards";
import { DividendHoldingsTable } from "@/components/dividends/DividendHoldingsTable";
import { DividendIncomeChart } from "@/components/dividends/DividendIncomeChart";
import { UpcomingDividends } from "@/components/dividends/UpcomingDividends";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function DividendsPage() {
  const initialized = usePortfolioStore((s) => s.initialized);
  const loadPortfolios = usePortfolioStore((s) => s.loadPortfolios);
  const portfolios = usePortfolioStore((s) => s.portfolios);

  // Ensure portfolios are loaded
  if (!initialized) {
    loadPortfolios();
  }

  const { holdings, loading: holdingsLoading, error: holdingsError } = useDividendHoldings();

  // Compute earliest purchase date per ticker for income history
  const earliestDates = useMemo(() => {
    const dates: Record<string, string> = {};
    for (const p of portfolios) {
      for (const h of p.holdings) {
        for (const lot of h.lots) {
          if (!dates[h.ticker] || lot.purchaseDate < dates[h.ticker]) {
            dates[h.ticker] = lot.purchaseDate;
          }
        }
      }
    }
    return dates;
  }, [portfolios]);

  const {
    monthlyIncome,
    loading: incomeLoading,
    error: incomeError,
  } = useDividendIncome(holdings, earliestDates);

  // Upcoming dividends (next 30 days)
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const { data: calendarData, loading: calendarLoading } = useCalendar(
    "dividends",
    formatDate(now),
    formatDate(in30Days)
  );

  const upcomingDividends = calendarData as DividendEvent[];

  const isLoading = !initialized || holdingsLoading;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Dividends</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track dividend income across all your portfolios
        </p>
      </div>

      {/* Error banner */}
      {holdingsError && (
        <div className="mb-4 p-3 rounded-lg bg-red-muted text-red-primary text-sm">
          {holdingsError}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !holdingsError && holdings.length === 0 ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
          <p className="text-text-secondary text-sm">
            No dividend-paying stocks in your portfolios yet.
            <br />
            Add stocks like KO, JNJ, or O to start tracking dividend income.
          </p>
        </div>
      ) : (
        <>
          <DividendSummaryCards
            holdings={holdings}
            upcomingDividends={upcomingDividends ?? []}
            loading={isLoading}
          />

          <DividendHoldingsTable holdings={holdings} loading={isLoading} />

          <DividendIncomeChart
            data={monthlyIncome}
            loading={incomeLoading}
            error={incomeError}
          />

          <UpcomingDividends
            data={upcomingDividends ?? []}
            loading={calendarLoading}
          />
        </>
      )}
    </div>
  );
}
