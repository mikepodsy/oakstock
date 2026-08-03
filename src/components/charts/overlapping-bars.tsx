"use client";

import { useChartStable } from "./chart-context";

export interface OverlappingBarsSeries {
  dataKey: string;
  color: string;
}

export interface OverlappingBarsProps {
  series: OverlappingBarsSeries[];
  /** Fraction of the band the column occupies (0-1). Default: 0.88 */
  bandFill?: number;
  /** Maximum column width in px. */
  maxBarWidth?: number;
  /** Corner radius in px. Default: 1 */
  radius?: number;
}

/**
 * Draws every series as a full-width bar rising or falling from the zero line,
 * all sharing one category slot so they overlap.
 *
 * Within each category the bars are painted largest-magnitude first, so smaller
 * bars land in front and stay visible instead of being swallowed by a taller
 * neighbour. `<Bar>` always allocates a separate column per series, so this
 * layout can't be expressed with the stock component.
 *
 * Vertical charts only.
 */
export function OverlappingBars({
  series,
  bandFill = 0.88,
  maxBarWidth,
  radius = 1,
}: OverlappingBarsProps) {
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
  const zeroY = yScale(0);

  return (
    <g>
      {data.map((datum, index) => {
        const bandPos = barScale(barXAccessor(datum));
        if (bandPos === undefined) {
          return null;
        }

        const bars = series
          .map(({ dataKey, color }) => ({
            dataKey,
            color,
            value: Number(datum[dataKey] ?? 0),
          }))
          .filter((bar) => bar.value !== 0)
          // Largest magnitude first → drawn behind, so smaller bars stay visible.
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

        return bars.map(({ dataKey, color, value }) => {
          const valueY = yScale(value);
          return (
            <rect
              fill={color}
              height={Math.max(Math.abs(valueY - zeroY), 1)}
              key={`${dataKey}-${index}`}
              rx={radius}
              width={columnWidth}
              x={bandPos + inset}
              y={Math.min(valueY, zeroY)}
            />
          );
        });
      })}
    </g>
  );
}

OverlappingBars.displayName = "OverlappingBars";
