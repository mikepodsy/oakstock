"use client";

import { useChartStable } from "./chart-context";

export interface SignedStackedBarsSeries {
  dataKey: string;
  color: string;
  opacity?: number;
}

export interface SignedStackedBarsProps {
  series: SignedStackedBarsSeries[];
  /** Fraction of the band the column occupies (0-1). Default: 0.88 */
  bandFill?: number;
  /** Maximum column width in px. */
  maxBarWidth?: number;
  /** Corner radius in px. Default: 1 */
  radius?: number;
}

/**
 * Stacked bars that grow up from zero for positive values and down for negative
 * ones, tracking each direction on its own cumulative offset.
 *
 * `<BarChart stacked>` keeps a single running total per category, so a
 * mixed-sign stack cancels itself out rather than extending in both directions.
 * This keeps two independent accumulators instead.
 *
 * Vertical charts only.
 */
export function SignedStackedBars({
  series,
  bandFill = 0.88,
  maxBarWidth,
  radius = 1,
}: SignedStackedBarsProps) {
  const { data, barScale, barXAccessor, yScale, orientation } =
    useChartStable();

  if (orientation === "horizontal" || !(barScale && barXAccessor && yScale)) {
    return null;
  }

  const bandWidth = barScale.bandwidth();
  const columnWidth = Math.min(
    bandWidth * bandFill,
    maxBarWidth ?? Number.POSITIVE_INFINITY
  );
  const inset = (bandWidth - columnWidth) / 2;

  return (
    <g>
      {data.map((datum, index) => {
        const bandPos = barScale(barXAccessor(datum));
        if (bandPos === undefined) {
          return null;
        }

        // Separate running totals so positives climb above the baseline while
        // negatives descend below it.
        let positiveTotal = 0;
        let negativeTotal = 0;

        return series.map(({ dataKey, color, opacity }) => {
          const value = Number(datum[dataKey] ?? 0);
          if (value === 0) {
            return null;
          }

          let start: number;
          let end: number;
          if (value > 0) {
            start = positiveTotal;
            positiveTotal += value;
            end = positiveTotal;
          } else {
            start = negativeTotal;
            negativeTotal += value;
            end = negativeTotal;
          }

          const startY = yScale(start);
          const endY = yScale(end);

          return (
            <rect
              fill={color}
              fillOpacity={opacity}
              height={Math.max(Math.abs(endY - startY), 1)}
              key={`${dataKey}-${index}`}
              rx={radius}
              width={columnWidth}
              x={bandPos + inset}
              y={Math.min(startY, endY)}
            />
          );
        });
      })}
    </g>
  );
}

SignedStackedBars.displayName = "SignedStackedBars";
