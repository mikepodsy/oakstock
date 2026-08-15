"use client";

import { useAnalystRating } from "@/hooks/useAnalystRating";
import { AnalystForecast } from "./AnalystForecast";

/**
 * The stock page's forecast block. Owns its own fetch — unlike the scanner,
 * nothing else on this page needs the analyst data.
 */
export function AnalystSection({ ticker }: { ticker: string }) {
  const result = useAnalystRating(ticker);

  // Uncovered symbols get nothing rather than an apology: the stock page has
  // plenty else to show, and the scanner is where someone goes looking for a
  // rating specifically.
  if (!result.loading && result.reason === "coverage") return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-display text-lg text-text-primary">Forecast</h2>
      <AnalystForecast ticker={ticker} {...result} />
    </section>
  );
}
