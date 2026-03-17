"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistCardDetail } from "./WatchlistCardDetail";
import { EditWatchlistDialog } from "./EditWatchlistDialog";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { PerformancePills } from "@/components/shared/PerformancePills";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import type { WatchlistItem, QuoteData } from "@/types";

interface WatchlistCardProps {
  watchlistId: string;
  item: WatchlistItem;
  quote?: QuoteData;
  isExpanded: boolean;
  onToggle: () => void;
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
