"use client";

import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/utils/formatters";
import type { QuoteData } from "@/types";

interface RadarListRowProps {
  ticker: string;
  name: string;
  quote?: QuoteData;
}

export function RadarListRow({ ticker, name, quote }: RadarListRowProps) {
  const router = useRouter();

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-bg-secondary border border-border-primary hover:border-oak-300/40 transition-colors cursor-pointer"
      onClick={() => router.push(`/stock/${ticker}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/stock/${ticker}`);
        }
      }}
    >
      <CompanyLogo ticker={ticker} website={quote?.website} />

      <div className="flex-1 min-w-0">
        <h3 className="font-financial text-base text-text-primary leading-tight">
          {ticker}
        </h3>
        <p className="text-xs text-text-tertiary truncate">{name}</p>
        {quote?.marketCap != null && (
          <p className="text-xs text-text-tertiary">
            Market Cap: ${formatCompactNumber(quote.marketCap)}
          </p>
        )}
      </div>

      <div className="text-right shrink-0 flex items-center gap-3">
        {quote ? (
          <>
            <p className="text-lg font-financial text-text-primary">
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
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-14" />
          </>
        )}
      </div>
    </div>
  );
}
