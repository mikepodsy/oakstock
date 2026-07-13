"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import { toast } from "sonner";
import type { WatchlistItem, QuoteData } from "@/types";

interface WatchlistListRowProps {
  watchlistId: string;
  item: WatchlistItem;
  quote?: QuoteData;
}

/**
 * Compact single-line variant of {@link WatchlistCard}, mirroring the Radar
 * list view. Clicking the row navigates to the stock page; a trailing button
 * removes the item from the watchlist.
 */
export function WatchlistListRow({ watchlistId, item, quote }: WatchlistListRowProps) {
  const router = useRouter();
  const removeItem = useWatchlistStore((s) => s.removeItem);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary hover:border-oak-300/40 transition-colors cursor-pointer"
      onClick={() => router.push(`/stock/${item.ticker}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/stock/${item.ticker}`);
        }
      }}
    >
      <CompanyLogo ticker={item.ticker} website={quote?.website} />

      <div className="flex-1 min-w-0">
        <h3 className="font-financial text-sm text-text-primary leading-tight">
          {item.ticker}
        </h3>
        <p className="text-xs text-text-tertiary truncate">{item.name}</p>
        {quote?.marketCap != null && (
          <p className="text-xs text-text-tertiary">
            ${formatCompactNumber(quote.marketCap)}
          </p>
        )}
      </div>

      <div className="text-right shrink-0 flex items-center gap-3">
        {quote ? (
          <>
            <p className="text-base font-financial text-text-primary">
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
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeItem(watchlistId, item.id);
            toast.success(`Removed ${item.ticker} from watchlist`);
          }}
          className="p-1.5 rounded-md text-text-tertiary hover:text-red-primary hover:bg-red-muted transition-colors"
          aria-label={`Remove ${item.ticker}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
