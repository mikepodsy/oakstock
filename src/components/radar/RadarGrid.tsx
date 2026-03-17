"use client";

import { RadarCard } from "./RadarCard";
import type { QuoteData } from "@/types";

interface RadarGridProps {
  tickers: { ticker: string; name: string }[];
  quotes: Record<string, QuoteData>;
  expandedTicker: string | null;
  onToggleExpand: (ticker: string) => void;
}

export function RadarGrid({
  tickers,
  quotes,
  expandedTicker,
  onToggleExpand,
}: RadarGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tickers.map(({ ticker, name }) => (
        <RadarCard
          key={ticker}
          ticker={ticker}
          name={name}
          quote={quotes[ticker]}
          isExpanded={expandedTicker === ticker}
          onToggle={() => onToggleExpand(ticker)}
        />
      ))}
    </div>
  );
}
