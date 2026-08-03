"use client";

import { useChartStable } from "./chart-context";

export interface BarValueLabelsProps {
  /** Key holding the bar's value — decides which side the label sits on. */
  dataKey: string;
  /** Label text for a row. Return `null` to skip that bar. */
  label: (datum: Record<string, unknown>, index: number) => string | null;
  /** Label color for a row. */
  color?: (datum: Record<string, unknown>, index: number) => string;
  /** Gap in px between the bar's end and the label. Default: 6 */
  offset?: number;
  fontSize?: number;
  fontFamily?: string;
}

/**
 * Text annotations pinned to the end of each bar in a **horizontal** bar chart.
 *
 * The registry has no `LabelList` equivalent, so this reads the band and value
 * scales off the chart context and places one `<text>` per row, flipping the
 * anchor so labels always sit outside the bar.
 *
 * Place it after `<Bar>` so labels paint on top.
 */
export function BarValueLabels({
  dataKey,
  label,
  color,
  offset = 6,
  fontSize = 11,
  fontFamily = "monospace",
}: BarValueLabelsProps) {
  const { data, barScale, barXAccessor, yScale, orientation } =
    useChartStable();

  if (orientation !== "horizontal" || !(barScale && barXAccessor && yScale)) {
    return null;
  }

  const bandWidth = barScale.bandwidth();

  return (
    <g aria-hidden="true">
      {data.map((datum, index) => {
        const text = label(datum, index);
        if (text === null) {
          return null;
        }

        const value = Number(datum[dataKey] ?? 0);
        const bandPos = barScale(barXAccessor(datum));
        if (bandPos === undefined) {
          return null;
        }

        const isPositive = value >= 0;
        const x = yScale(value) + (isPositive ? offset : -offset);

        return (
          <text
            dy={4}
            fill={color?.(datum, index) ?? "var(--chart-foreground-muted)"}
            fontFamily={fontFamily}
            fontSize={fontSize}
            key={barXAccessor(datum)}
            textAnchor={isPositive ? "start" : "end"}
            x={x}
            y={bandPos + bandWidth / 2}
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}

BarValueLabels.displayName = "BarValueLabels";
