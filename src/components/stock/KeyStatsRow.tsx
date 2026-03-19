"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCompactNumber } from "@/utils/formatters";
import type { QuoteData, FinancialData } from "@/types";

interface KeyStatsRowProps {
  quote: QuoteData;
  financials: FinancialData | null;
  loading: boolean;
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-sm font-financial font-medium text-text-primary">
        {value ?? <span className="text-text-tertiary">N/A</span>}
      </p>
    </div>
  );
}

function getRatingColor(rating: string): string {
  const lower = rating.toLowerCase();
  if (lower.includes("buy")) return "bg-green-muted text-green-primary";
  if (lower.includes("hold")) return "bg-yellow-500/10 text-yellow-500";
  return "bg-red-muted text-red-primary";
}

export function KeyStatsRow({ quote, financials, loading }: KeyStatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard
        label="P/E Ratio"
        value={financials?.peRatio != null ? financials.peRatio.toFixed(2) : null}
      />
      <StatCard
        label="EPS (TTM)"
        value={financials?.eps != null ? formatCurrency(financials.eps) : null}
      />
      <StatCard
        label="Div Yield"
        value={
          financials?.dividendYield != null
            ? `${(financials.dividendYield * 100).toFixed(2)}%`
            : null
        }
      />
      <StatCard
        label="Market Cap"
        value={
          quote.marketCap != null
            ? `$${formatCompactNumber(quote.marketCap)}`
            : null
        }
      />
      <StatCard
        label="52W High"
        value={
          financials?.fiftyTwoWeekHigh != null
            ? formatCurrency(financials.fiftyTwoWeekHigh)
            : null
        }
      />
      <StatCard
        label="52W Low"
        value={
          financials?.fiftyTwoWeekLow != null
            ? formatCurrency(financials.fiftyTwoWeekLow)
            : null
        }
      />
      <StatCard
        label="Debt/Equity"
        value={
          financials?.debtToEquity != null
            ? financials.debtToEquity.toFixed(2)
            : null
        }
      />
      <StatCard
        label="Analyst"
        value={
          financials?.analystRating ? (
            <Badge className={getRatingColor(financials.analystRating)}>
              {financials.analystRating}
            </Badge>
          ) : null
        }
      />
    </div>
  );
}
