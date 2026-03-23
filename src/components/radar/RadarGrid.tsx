"use client";

import { RadarCard } from "./RadarCard";
import { RadarListRow } from "./RadarListRow";
import type { QuoteData } from "@/types";

export type RadarViewMode = "cards" | "list";

interface RadarGridProps {
  tickers: { ticker: string; name: string }[];
  quotes: Record<string, QuoteData>;
  expandedTicker: string | null;
  onToggleExpand: (ticker: string) => void;
  viewMode: RadarViewMode;
}

export function RadarGrid({
  tickers,
  quotes,
  expandedTicker,
  onToggleExpand,
  viewMode,
}: RadarGridProps) {
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-2">
        {tickers.map(({ ticker, name }) => (
          <RadarListRow
            key={ticker}
            ticker={ticker}
            name={name}
            quote={quotes[ticker]}
          />
        ))}
      </div>
    );
  }

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
