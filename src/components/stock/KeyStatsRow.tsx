"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatCompactNumber,
  formatPercent,
} from "@/utils/formatters";
import type { QuoteData, FinancialData } from "@/types";

interface KeyStatsRowProps {
  quote: QuoteData;
  financials: FinancialData | null;
  loading: boolean;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-green-primary"
      : tone === "negative"
        ? "text-red-primary"
        : "text-text-primary";

  return (
    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className={`text-sm font-financial font-medium ${toneClass}`}>
        {value ?? <span className="text-text-tertiary">N/A</span>}
      </p>
    </div>
  );
}

export function KeyStatsRow({ quote, financials, loading }: KeyStatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  const growth = financials?.revenueGrowth;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <StatCard
        label="P/E Ratio"
        value={financials?.peRatio != null ? financials.peRatio.toFixed(2) : null}
      />
      <StatCard
        label="Forward P/E"
        value={
          financials?.forwardPE != null ? financials.forwardPE.toFixed(2) : null
        }
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
      {/* Yahoo's quarterly revenue growth vs. the same quarter a year ago. */}
      <StatCard
        label="Rev Growth (YoY)"
        value={growth != null ? formatPercent(growth * 100) : null}
        tone={growth == null ? undefined : growth >= 0 ? "positive" : "negative"}
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
      {/* The consensus verdict itself now has a gauge in the Forecast section
          below, so this slot carries the number that isn't shown there. */}
      <StatCard
        label="Price Target"
        value={
          financials?.targetPrice != null
            ? formatCurrency(financials.targetPrice)
            : null
        }
      />
    </div>
  );
}
