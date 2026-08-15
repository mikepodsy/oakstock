"use client";

import type { AnalystDistribution } from "@/types";
import { distributionRows } from "@/utils/analystRating";

interface RatingDistributionProps {
  distribution: AnalystDistribution | null;
  /** Smaller type and tighter rows, for the narrow scanner panel. */
  compact?: boolean;
}

/**
 * The recommendation breakdown: one track per bucket, strongest buy first.
 *
 * Bars are scaled against the biggest bucket rather than the analyst total —
 * consensus is usually lopsided, and scaling by total leaves every bar stubby.
 */
export function RatingDistribution({
  distribution,
  compact = false,
}: RatingDistributionProps) {
  const rows = distributionRows(distribution);
  if (rows.length === 0) return null;

  const text = compact ? "text-[11px]" : "text-xs";

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 ${text}`}
        >
          <span className="whitespace-nowrap text-text-tertiary">
            {row.label}
          </span>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary"
            role="presentation"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                // Zero-count buckets keep their empty track, so the five rows
                // always line up between symbols.
                width: `${row.fraction * 100}%`,
                backgroundColor: row.color,
              }}
            />
          </div>

          <span className="w-6 whitespace-nowrap text-right font-financial tabular-nums text-text-primary">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
