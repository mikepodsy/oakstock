"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  ratingColor,
  ratingLabel,
  type TechnicalRating,
} from "@/utils/technicalRating";
import { RatingGauge } from "./RatingGauge";

interface TechnicalsSummaryProps {
  rating: TechnicalRating | null;
  loading: boolean;
  onOpenDetail: () => void;
}

/** Compact verdict line for one of the two indicator groups. */
function GroupLine({
  label,
  rating,
}: {
  label: string;
  rating: TechnicalRating["oscillators"];
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-tertiary">{label}</span>
      <span style={{ color: ratingColor(rating.rating) }}>
        {ratingLabel(rating.rating)}
      </span>
    </div>
  );
}

export function TechnicalsSummary({
  rating,
  loading,
  onOpenDetail,
}: TechnicalsSummaryProps) {
  return (
    <div className="shrink-0 border-t border-border-primary px-3 py-3">
      <div className="mb-1 text-xs font-medium text-text-primary">Technicals</div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Skeleton className="h-16 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : !rating ? (
        <p className="py-3 text-center text-xs text-text-tertiary">
          Not enough history to rate this symbol.
        </p>
      ) : (
        <>
          <RatingGauge score={rating.summary.score} rating={rating.summary.rating} />

          <div className="mt-2 flex flex-col gap-1">
            <GroupLine label="Oscillators" rating={rating.oscillators} />
            <GroupLine label="Moving averages" rating={rating.movingAverages} />
          </div>

          <button
            onClick={onOpenDetail}
            className="mt-3 w-full rounded-full bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            More technicals
          </button>
        </>
      )}
    </div>
  );
}
