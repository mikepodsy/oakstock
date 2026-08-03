"use client";

import { useChartStable } from "./chart-context";

export interface ZeroLineProps {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

/**
 * A baseline rule at y = 0, for charts whose values cross zero.
 *
 * `<ReferenceArea>` can express a y-only band, but not a hairline, and its
 * x-bounds path calls the chart's time scale — which `<BarChart>` publishes as
 * a non-callable stand-in.
 */
export function ZeroLine({
  stroke = "var(--chart-grid)",
  strokeWidth = 1,
  strokeDasharray,
}: ZeroLineProps) {
  const { yScale, innerWidth, orientation } = useChartStable();

  if (orientation === "horizontal" || !yScale) {
    return null;
  }

  const y = yScale(0);

  return (
    <line
      aria-hidden="true"
      stroke={stroke}
      strokeDasharray={strokeDasharray}
      strokeWidth={strokeWidth}
      x1={0}
      x2={innerWidth}
      y1={y}
      y2={y}
    />
  );
}

ZeroLine.displayName = "ZeroLine";
