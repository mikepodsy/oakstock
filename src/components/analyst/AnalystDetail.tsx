"use client";

import { ChevronLeft } from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import type { AnalystRatingResult } from "@/hooks/useAnalystRating";
import { AnalystForecast } from "./AnalystForecast";

interface AnalystDetailProps extends AnalystRatingResult {
  ticker: string;
  onBack: () => void;
}

/**
 * The "More analysts" view. Replaces the chart pane the same way
 * TechnicalsDetail does, so the symbol list stays put.
 *
 * There is deliberately no timeframe row here: sell-side consensus is the same
 * number whichever candle interval the chart happens to be on.
 */
export function AnalystDetail({
  ticker,
  onBack,
  ...result
}: AnalystDetailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
        <h2 className="flex items-center gap-2.5 font-display text-xl text-text-primary">
          <CompanyLogo
            ticker={ticker}
            className="h-7 w-7 rounded-md"
            textClassName="text-[10px]"
          />
          <span className="font-financial">{ticker}</span>
          <span className="text-text-tertiary">· Forecast</span>
        </h2>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-tertiary px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to chart
        </button>
      </div>

      {/* The pane is a fixed-height flex child, so this scrolls on its own. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2 pr-1">
        <AnalystForecast ticker={ticker} {...result} />
      </div>
    </div>
  );
}
