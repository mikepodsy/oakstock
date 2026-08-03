"use client";

import { useChartStable } from "./chart-context";

export interface BandReferenceAreaProps {
  /** First category label inside the band. Omit to start at the plot's left edge. */
  x1?: string;
  /** Last category label inside the band. Omit to run to the plot's right edge. */
  x2?: string;
  /** Band fill. Default: the chart grid color. */
  fill?: string;
  /** Band opacity. Default: 0.35 */
  fillOpacity?: number;
  /** Optional caption drawn at the band's top-left. */
  label?: string;
  /** Caption color. Default: the muted chart foreground. */
  labelColor?: string;
}

/**
 * A reference band for categorical (band-scale) charts.
 *
 * The registry's `<ReferenceArea>` resolves its x bounds through the chart's
 * time scale, but `<BarChart>` publishes a non-callable stand-in for `xScale`,
 * so an x-ranged `<ReferenceArea>` throws inside a bar chart. This reads the
 * band scale directly and shades a span of categories instead.
 *
 * Place it before `<Bar>` so the bars paint over the band.
 */
export function BandReferenceArea({
  x1,
  x2,
  fill = "var(--chart-grid)",
  fillOpacity = 0.35,
  label,
  labelColor = "var(--chart-foreground-muted)",
}: BandReferenceAreaProps) {
  const { barScale, innerWidth, innerHeight } = useChartStable();

  if (!barScale) {
    return null;
  }

  const bandWidth = barScale.bandwidth();
  // Half the inter-band gap, so the band meets its neighbours midway between
  // columns rather than clipping to the bars themselves.
  const gutter = Math.max(0, (barScale.step() - bandWidth) / 2);

  const start = x1 === undefined ? 0 : barScale(x1);
  const end = x2 === undefined ? undefined : barScale(x2);

  // A category that isn't in the domain gives `undefined` — skip rather than
  // render a band pinned at zero.
  if (start === undefined || (x2 !== undefined && end === undefined)) {
    return null;
  }

  const left = x1 === undefined ? 0 : start - gutter;
  const right =
    end === undefined ? innerWidth : end + bandWidth + gutter;
  const width = Math.min(innerWidth, right) - Math.max(0, left);

  if (width <= 0) {
    return null;
  }

  return (
    <g aria-hidden="true">
      <rect
        fill={fill}
        height={innerHeight}
        opacity={fillOpacity}
        width={width}
        x={Math.max(0, left)}
        y={0}
      />
      {label ? (
        <text
          fill={labelColor}
          fontSize={10}
          x={Math.max(0, left) + 6}
          y={12}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

BandReferenceArea.displayName = "BandReferenceArea";
