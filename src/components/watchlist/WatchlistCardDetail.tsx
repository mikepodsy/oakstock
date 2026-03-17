"use client";

import { useState } from "react";
import { useFinancials } from "@/hooks/useFinancials";
import { StockPriceChart } from "@/components/charts/StockPriceChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatCompactNumber,
  formatPercent,
} from "@/utils/formatters";

interface WatchlistCardDetailProps {
  ticker: string;
  currentPrice: number;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg bg-bg-tertiary p-3">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-sm font-financial text-text-primary">
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

export function WatchlistCardDetail({
  ticker,
  currentPrice,
}: WatchlistCardDetailProps) {
  const { data, loading, error, refetch } = useFinancials(ticker);
  const [showFullDesc, setShowFullDesc] = useState(false);

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-border-primary space-y-4">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t border-border-primary">
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-text-secondary mb-2">
            Failed to load details
          </p>
          <button
            onClick={refetch}
            className="text-sm text-green-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const description = data?.description ?? null;
  const truncatedDesc =
    description && description.length > 300 && !showFullDesc
      ? description.slice(0, 300).replace(/\s+\S*$/, "") + "..."
      : description;

  return (
    <div className="mt-4 pt-4 border-t border-border-primary space-y-5">
      {/* Price Chart */}
      <StockPriceChart ticker={ticker} />

      {/* Key Financials */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">
          Key Financials
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="P/E Ratio"
            value={data?.peRatio != null ? data.peRatio.toFixed(2) : null}
          />
          <MetricCard
            label="EPS (TTM)"
            value={data?.eps != null ? formatCurrency(data.eps) : null}
          />
          <MetricCard
            label="Revenue (TTM)"
            value={
              data?.revenue != null
                ? `$${formatCompactNumber(data.revenue)}`
                : null
            }
          />
          <MetricCard
            label="Profit Margin"
            value={
              data?.profitMargin != null
                ? `${(data.profitMargin * 100).toFixed(1)}%`
                : null
            }
          />
          <MetricCard
            label="52W High"
            value={
              data?.fiftyTwoWeekHigh != null
                ? formatCurrency(data.fiftyTwoWeekHigh)
                : null
            }
          />
          <MetricCard
            label="52W Low"
            value={
              data?.fiftyTwoWeekLow != null
                ? formatCurrency(data.fiftyTwoWeekLow)
                : null
            }
          />
          <MetricCard
            label="Debt/Equity"
            value={
              data?.debtToEquity != null ? data.debtToEquity.toFixed(2) : null
            }
          />
          <MetricCard
            label="Dividend Yield"
            value={
              data?.dividendYield != null
                ? `${(data.dividendYield * 100).toFixed(2)}%`
                : null
            }
          />
        </div>
      </div>

      {/* About */}
      {truncatedDesc && (
        <div className="rounded-lg bg-bg-tertiary p-3">
          <p className="text-xs text-text-tertiary mb-1">About</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {truncatedDesc}
          </p>
          {description && description.length > 300 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-xs text-green-primary hover:underline mt-1"
            >
              {showFullDesc ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Analyst Consensus */}
      {data?.analystRating && (
        <div className="rounded-lg bg-bg-tertiary p-3">
          <p className="text-xs text-text-tertiary mb-2">Analyst Consensus</p>
          <div className="flex items-center gap-3">
            <Badge className={getRatingColor(data.analystRating)}>
              {data.analystRating}
            </Badge>
            {data.targetPrice != null && (
              <span className="text-xs text-text-secondary">
                Target: {formatCurrency(data.targetPrice)}
                {currentPrice > 0 && (
                  <span
                    className={
                      data.targetPrice >= currentPrice
                        ? "text-green-primary"
                        : "text-red-primary"
                    }
                  >
                    {" "}
                    ({formatPercent(
                      ((data.targetPrice - currentPrice) / currentPrice) * 100
                    )})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
