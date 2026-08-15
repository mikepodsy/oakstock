"use client";

import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TechnicalRatingResult } from "@/hooks/useTechnicalRating";
import { ratingColor, ratingLabel, type RatingGroup } from "@/utils/technicalRating";
import { RatingGauge } from "./RatingGauge";

interface TechnicalsSummaryProps extends TechnicalRatingResult {
  onOpenDetail: () => void;
}

/** Compact verdict line for one of the two indicator groups. */
function GroupLine({ label, group }: { label: string; group: RatingGroup }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="whitespace-nowrap text-xs text-text-tertiary">
        {label}
      </span>
      <span
        className="whitespace-nowrap text-xs font-medium"
        style={{ color: ratingColor(group.rating) }}
      >
        {ratingLabel(group.rating)}
      </span>
    </div>
  );
}

export function TechnicalsSummary({
  rating,
  loading,
  reason,
  retry,
  onOpenDetail,
}: TechnicalsSummaryProps) {
  return (
    <div className="shrink-0 p-3">
      <div className="rounded-xl border border-border-primary bg-bg-primary p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">Technicals</h3>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : !rating ? (
          <div className="py-2 text-center">
            <p className="text-xs leading-relaxed text-text-secondary">
              {reason === "fetch"
                ? "Couldn't load candle data for this symbol."
                : "Not enough price history to rate this symbol."}
            </p>
            {reason === "fetch" && (
              <button
                onClick={retry}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg-tertiary px-4 py-1.5 text-xs font-medium whitespace-nowrap text-text-secondary transition-colors hover:text-text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <RatingGauge score={rating.summary.score} rating={rating.summary.rating} />

            <div className="mt-4 flex flex-col gap-2 border-t border-border-secondary pt-3">
              <GroupLine label="Oscillators" group={rating.oscillators} />
              <GroupLine label="Moving averages" group={rating.movingAverages} />
            </div>

            <button
              onClick={onOpenDetail}
              className="mt-4 w-full rounded-full bg-bg-tertiary px-4 py-1.5 text-xs font-medium whitespace-nowrap text-text-secondary transition-colors hover:text-text-primary"
            >
              More technicals
            </button>
          </>
        )}
      </div>
    </div>
  );
}
