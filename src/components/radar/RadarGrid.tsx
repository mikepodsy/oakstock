"use client";

import { RadarCard } from "./RadarCard";
import { RadarListRow } from "./RadarListRow";
import type { QuoteData } from "@/types";

export type RadarViewMode = "cards" | "list";

interface RadarGridProps {
  tickers: { ticker: string; name: string; change?: number }[];
  quotes: Record<string, QuoteData>;
  /** True while period returns for a non-"Today" timeframe are still loading. */
  changeLoading?: boolean;
  expandedTicker: string | null;
  onToggleExpand: (ticker: string) => void;
  viewMode: RadarViewMode;
}

export function RadarGrid({
  tickers,
  quotes,
  changeLoading = false,
  expandedTicker,
  onToggleExpand,
  viewMode,
}: RadarGridProps) {
  if (viewMode === "list") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {tickers.map(({ ticker, name, change }) => (
          <RadarListRow
            key={ticker}
            ticker={ticker}
            name={name}
            quote={quotes[ticker]}
            change={change}
            changeLoading={changeLoading}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tickers.map(({ ticker, name, change }) => (
        <RadarCard
          key={ticker}
          ticker={ticker}
          name={name}
          quote={quotes[ticker]}
          change={change}
          changeLoading={changeLoading}
          isExpanded={expandedTicker === ticker}
          onToggle={() => onToggleExpand(ticker)}
        />
      ))}
    </div>
  );
}
