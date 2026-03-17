"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistCardDetail } from "./WatchlistCardDetail";
import { EditWatchlistDialog } from "./EditWatchlistDialog";
import { usePerformanceReturns } from "@/hooks/usePerformanceReturns";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import type { WatchlistItem, QuoteData, PerformancePeriod } from "@/types";

interface WatchlistCardProps {
  watchlistId: string;
  item: WatchlistItem;
  quote?: QuoteData;
  isExpanded: boolean;
  onToggle: () => void;
}

const LOGO_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function getLogoColor(ticker: string): string {
  const hash = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

function CompanyLogo({
  ticker,
  website,
}: {
  ticker: string;
  website?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const domain = website
    ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : null;
  const logoUrl =
    token && domain ? `https://img.logo.dev/${domain}?token=${token}&size=128` : null;

  if (!logoUrl || imgError) {
    return (
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
        style={{ backgroundColor: getLogoColor(ticker) }}
      >
        {ticker.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${ticker} logo`}
      className="w-14 h-14 rounded-xl object-contain bg-white shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

const PERF_PERIODS: PerformancePeriod[] = ["1M", "3M", "YTD", "1Y", "3Y", "5Y"];

function PerformancePills({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice: number;
}) {
  const { returns, loading } = usePerformanceReturns(ticker, currentPrice);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {PERF_PERIODS.map((p) => (
          <Skeleton key={p} className="h-7 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {PERF_PERIODS.map((period) => {
        const value = returns?.[period] ?? null;
        if (value === null) {
          return (
            <span
              key={period}
              className="px-3 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-tertiary"
            >
              {period}: —
            </span>
          );
        }
        const isPositive = value >= 0;
        return (
          <span
            key={period}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPositive
                ? "bg-green-muted text-green-primary"
                : "bg-red-muted text-red-primary"
            }`}
          >
            {period}: {value >= 0 ? "+" : ""}
            {value.toFixed(2)}%
          </span>
        );
      })}
    </div>
  );
}

export function WatchlistCard({
  watchlistId,
  item,
  quote,
  isExpanded,
  onToggle,
}: WatchlistCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div
        className={`rounded-xl border bg-bg-secondary transition-all duration-300 ${
          isExpanded
            ? "border-green-primary/40 shadow-lg"
            : "border-border-primary hover:border-oak-300/40"
        }`}
      >
        {/* Clickable card header */}
        <div
          className="p-5 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          {/* Top row: Logo + Info + Price */}
          <div className="flex items-center gap-4 mb-4">
            <CompanyLogo ticker={item.ticker} website={quote?.website} />
            <div className="flex-1 min-w-0">
              <h3 className="font-financial text-lg text-text-primary">
                {item.ticker}
              </h3>
              <p className="text-xs text-text-tertiary truncate">{item.name}</p>
              {quote?.marketCap != null && (
                <p className="text-xs text-text-tertiary">
                  Market Cap: ${formatCompactNumber(quote.marketCap)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {quote ? (
                <>
                  <p className="text-xl font-financial text-text-primary">
                    {formatCurrency(quote.currentPrice)}
                  </p>
                  <Badge
                    className={
                      quote.dayChangePercent >= 0
                        ? "bg-green-muted text-green-primary"
                        : "bg-red-muted text-red-primary"
                    }
                  >
                    {formatPercent(quote.dayChangePercent)}
                  </Badge>
                </>
              ) : (
                <>
                  <Skeleton className="h-7 w-24 mb-1 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </>
              )}
            </div>
          </div>

          {/* Performance Pills */}
          {quote && (
            <div className="text-center">
              <p className="text-xs font-medium text-text-secondary mb-2">
                Performance
              </p>
              <PerformancePills
                ticker={item.ticker}
                currentPrice={quote.currentPrice}
              />
            </div>
          )}
        </div>

        {/* Expanded Detail (Accordion) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{
            ...(typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? { transition: "none" }
              : {}),
          }}
        >
          {isExpanded && quote && (
            <div className="px-5 pb-5">
              <WatchlistCardDetail
                ticker={item.ticker}
                currentPrice={quote.currentPrice}
              />

              {/* Edit button */}
              <div className="mt-4 pt-3 border-t border-border-primary">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogOpen(true);
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  Edit target price & notes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditWatchlistDialog
        watchlistId={watchlistId}
        item={item}
        quote={quote}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
