"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { PerformancePills } from "@/components/shared/PerformancePills";
import { WatchlistCardDetail } from "@/components/watchlist/WatchlistCardDetail";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import { toast } from "sonner";
import type { QuoteData } from "@/types";

interface RadarCardProps {
  ticker: string;
  name: string;
  quote?: QuoteData;
  isExpanded: boolean;
  onToggle: () => void;
}

export function RadarCard({
  ticker,
  name,
  quote,
  isExpanded,
  onToggle,
}: RadarCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const watchlists = useWatchlistStore((s) => s.watchlists);
  const addItem = useWatchlistStore((s) => s.addItem);

  function handleAddToWatchlist(watchlistId: string) {
    const watchlist = watchlists.find((w) => w.id === watchlistId);
    if (!watchlist) return;

    if (watchlist.items.find((i) => i.ticker === ticker)) {
      toast.error(`${ticker} is already in "${watchlist.name}"`);
      return;
    }

    addItem(watchlistId, { ticker, name });
    toast.success(`Added ${ticker} to "${watchlist.name}"`);
  }

  return (
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
          <CompanyLogo ticker={ticker} website={quote?.website} />
          <div
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/stock/${ticker}`);
            }}
          >
            <h3 className="font-financial text-lg text-text-primary hover:text-green-primary transition-colors">
              {ticker}
            </h3>
            <p className="text-xs text-text-tertiary truncate">{name}</p>
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
            <PerformancePills ticker={ticker} currentPrice={quote.currentPrice} />
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
            <WatchlistCardDetail ticker={ticker} currentPrice={quote.currentPrice} />
          </div>
        )}
      </div>

      {/* Add to Watchlist button */}
      <div className="px-5 pb-4 pt-1 border-t border-border-primary">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-1 text-xs text-green-primary hover:text-green-primary/80 transition-colors mx-auto"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Watchlist
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" sideOffset={4}>
            <DropdownMenuGroup>
              {watchlists.length === 0 ? (
                <DropdownMenuLabel>No watchlists created</DropdownMenuLabel>
              ) : (
                <>
                  <DropdownMenuLabel>Add to...</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {watchlists.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onClick={() => handleAddToWatchlist(w.id)}
                    >
                      {w.name}
                      <span className="ml-auto text-xs text-text-tertiary">
                        {w.items.length}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
