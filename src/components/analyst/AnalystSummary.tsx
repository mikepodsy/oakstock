"use client";

import { RefreshCw } from "lucide-react";
import { RatingGauge } from "@/components/scanner/RatingGauge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalystRatingResult } from "@/hooks/useAnalystRating";
import { distributionTotal, targetUpside } from "@/utils/analystRating";
import { formatCurrency } from "@/utils/formatters";

interface AnalystSummaryProps extends AnalystRatingResult {
  onOpenDetail: () => void;
}

/** Label / value line, matching the technicals card's breakdown rows. */
function StatLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="whitespace-nowrap text-xs text-text-tertiary">
        {label}
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-text-primary">
        {children}
      </span>
    </div>
  );
}

/**
 * The analyst card pinned under the technicals card in the scanner panel.
 * Same shape as TechnicalsSummary — gauge, a couple of breakdown lines, and a
 * button into the expanded view.
 */
export function AnalystSummary({
  data,
  score,
  rating,
  loading,
  reason,
  retry,
  onOpenDetail,
}: AnalystSummaryProps) {
  const upside = targetUpside(data?.target?.mean, data?.currentPrice);
  const analysts = distributionTotal(data?.distribution);

  return (
    <div className="shrink-0 px-3 pb-3">
      <div className="rounded-xl border border-border-primary bg-bg-primary p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">
          Analyst rating
        </h3>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : rating == null || score == null ? (
          <div className="py-2 text-center">
            <p className="text-xs leading-relaxed text-text-secondary">
              {reason === "fetch"
                ? "Couldn't load analyst data for this symbol."
                : "No analyst data for this symbol."}
            </p>
            {/* Only a failed request is worth retrying. "No coverage" is a real
                answer — ETFs, indices and FX pairs never have one. */}
            {reason === "fetch" && (
              <button
                onClick={retry}
                className="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-tertiary px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <RatingGauge score={score} rating={rating} />

            <div className="mt-4 flex flex-col gap-2 border-t border-border-secondary pt-3">
              {data?.target && (
                <StatLine label="Price target">
                  {formatCurrency(data.target.mean)}
                  {upside && (
                    <span
                      className="ml-1.5"
                      style={{
                        color:
                          upside.percent >= 0
                            ? "var(--green-primary)"
                            : "var(--red-primary)",
                      }}
                    >
                      {upside.percent >= 0 ? "+" : "−"}
                      {Math.abs(upside.percent * 100).toFixed(1)}%
                    </span>
                  )}
                </StatLine>
              )}
              {analysts > 0 && (
                <StatLine label="Analysts">{analysts}</StatLine>
              )}
            </div>

            <button
              onClick={onOpenDetail}
              className="mt-4 w-full whitespace-nowrap rounded-full bg-bg-tertiary px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              More analysts
            </button>
          </>
        )}
      </div>
    </div>
  );
}
