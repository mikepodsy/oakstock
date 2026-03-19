"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import type { QuoteData } from "@/types";

interface StockHeaderProps {
  quote: QuoteData;
}

export function StockHeader({ quote }: StockHeaderProps) {
  const router = useRouter();
  const isPositive = quote.dayChange >= 0;

  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={() => router.back()}
        className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-text-secondary" />
      </button>

      <CompanyLogo ticker={quote.ticker} website={quote.website} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-display font-semibold text-text-primary truncate">
            {quote.name}
          </h1>
          <span className="text-sm text-text-tertiary font-financial">
            {quote.ticker}
          </span>
        </div>
        {quote.sector && (
          <p className="text-xs text-text-tertiary mt-0.5">{quote.sector}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-2xl font-financial font-semibold text-text-primary">
          {formatCurrency(quote.currentPrice)}
        </p>
        <Badge
          className={
            isPositive
              ? "bg-green-muted text-green-primary"
              : "bg-red-muted text-red-primary"
          }
        >
          {formatPercent(quote.dayChangePercent)} (
          {isPositive ? "+" : ""}
          {formatCurrency(Math.abs(quote.dayChange))})
        </Badge>
      </div>
    </div>
  );
}
