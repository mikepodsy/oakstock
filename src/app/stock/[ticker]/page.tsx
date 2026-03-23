"use client";

import { useParams } from "next/navigation";
import { useQuotes } from "@/hooks/useQuotes";
import { useFinancials } from "@/hooks/useFinancials";
import { useFundamentals } from "@/hooks/useFundamentals";
import { StockHeader } from "@/components/stock/StockHeader";
import { StockPriceChart } from "@/components/charts/StockPriceChart";
import { KeyStatsRow } from "@/components/stock/KeyStatsRow";
import { FinancialChartsGrid } from "@/components/stock/FinancialChartsGrid";
import { CompanyDescription } from "@/components/stock/CompanyDescription";
import { SentimentSection } from "@/components/stock/SentimentSection";
import { Skeleton } from "@/components/ui/skeleton";

export default function StockDetailPage() {
  const params = useParams();
  const ticker = (params.ticker as string).toUpperCase();

  const { quotes, loading: quotesLoading } = useQuotes([ticker]);
  const quote = quotes[ticker];

  const { data: financials, loading: financialsLoading } = useFinancials(ticker);
  const {
    data: fundamentals,
    loading: fundamentalsLoading,
    error: fundamentalsError,
    refetch,
  } = useFundamentals(ticker);

  if (quotesLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="text-right">
            <Skeleton className="h-8 w-28 mb-1" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg text-text-secondary mb-2">
            Stock not found: {ticker}
          </p>
          <button
            onClick={() => window.history.back()}
            className="text-sm text-green-primary hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <StockHeader quote={quote} />

      <div className="mb-6">
        <StockPriceChart ticker={ticker} />
      </div>

      <SentimentSection ticker={ticker} />

      <KeyStatsRow
        quote={quote}
        financials={financials}
        loading={financialsLoading}
      />

      {fundamentalsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border-primary bg-bg-secondary p-4"
            >
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-[160px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : fundamentalsError ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 text-center mb-6">
          <p className="text-sm text-text-secondary mb-2">
            Failed to load financial data
          </p>
          <button
            onClick={refetch}
            className="text-sm text-green-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : fundamentals ? (
        <FinancialChartsGrid data={fundamentals} />
      ) : null}

      <CompanyDescription description={financials?.description ?? null} />
    </div>
  );
}
