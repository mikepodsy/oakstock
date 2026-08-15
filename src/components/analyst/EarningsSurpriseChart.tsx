"use client";

import { useMemo } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { useChart } from "@/components/charts/chart-context";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import { formatFiscalPeriod } from "@/utils/formatters";
import type { EpsPeriod } from "@/types";

interface EarningsSurpriseChartProps {
  /** Quarterly EPS, oldest first — reported quarters plus forward estimates. */
  quarterly: EpsPeriod[];
}

const BEAT_COLOR = "var(--green-primary)";
const MISS_COLOR = "var(--red-primary)";
const ESTIMATE_COLOR = "var(--text-tertiary)";

/** Reported quarters shown. Keeps the dots readable in the narrow column. */
const MAX_REPORTED = 4;

/** Forward quarters shown — one, so the chart stays about results. */
const MAX_FORECAST = 1;

const DOT_RADIUS = 5.5;

function fmtEps(v: number): string {
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
}

interface Row extends Record<string, unknown> {
  label: string;
  Actual: number | null;
  Estimate: number | null;
  /** null when the quarter has no pair to compare. */
  beat: boolean | null;
}

/**
 * The dots themselves, drawn straight onto the band scale.
 *
 * The chart has no scatter primitive, so the two transparent `<Bar>` series in
 * the parent exist only to put both values into the y-domain — this layer does
 * all the drawing, centred on the band rather than on a bar's sub-band.
 */
function SurpriseDots() {
  const { data, barScale, bandWidth, yScale, hoveredBarIndex } = useChart();

  if (!(barScale && bandWidth && yScale)) return null;

  return (
    <g aria-hidden="true">
      {(data as Row[]).map((row, i) => {
        const bandPos = barScale(row.label);
        if (bandPos === undefined) return null;

        const cx = bandPos + bandWidth / 2;
        const dimmed = hoveredBarIndex !== null && hoveredBarIndex !== i;

        return (
          <g
            key={row.label}
            opacity={dimmed ? 0.35 : 1}
            style={{ transition: "opacity 0.15s ease-in-out" }}
          >
            {/* Estimate first, so a beat's dot paints over its own ring. */}
            {row.Estimate != null && (
              <circle
                cx={cx}
                cy={yScale(row.Estimate)}
                fill="none"
                r={DOT_RADIUS}
                stroke={ESTIMATE_COLOR}
                strokeWidth={1.5}
              />
            )}
            {row.Actual != null && (
              <circle
                cx={cx}
                cy={yScale(row.Actual)}
                fill={row.beat === false ? MISS_COLOR : BEAT_COLOR}
                r={DOT_RADIUS}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

SurpriseDots.displayName = "SurpriseDots";

/**
 * Reported EPS against the consensus it was measured against, quarter by
 * quarter — a filled dot for the result, a hollow ring for the estimate.
 *
 * A miss turns the dot red rather than moving it, so beat and miss stay
 * comparable on one scale instead of becoming two charts.
 */
export function EarningsSurpriseChart({
  quarterly,
}: EarningsSurpriseChartProps) {
  const rows = useMemo<Row[]>(() => {
    // Split rather than take a trailing slice: the series usually carries two
    // forward quarters, and letting them push reported ones off the left turns
    // a results chart into a forecast chart.
    const reported = quarterly.filter((p) => p.actual != null);
    const forecast = quarterly.filter((p) => p.actual == null);

    return [
      ...reported.slice(-MAX_REPORTED),
      ...forecast.slice(0, MAX_FORECAST),
    ].map((p) => ({
      label: p.label,
      Actual: p.actual,
      Estimate: p.estimate,
      beat:
        p.actual != null && p.estimate != null ? p.actual >= p.estimate : null,
    }));
  }, [quarterly]);

  const scored = rows.filter((r) => r.beat !== null);
  const beats = scored.filter((r) => r.beat).length;

  // Nothing to compare means nothing to show — an axis with no dots is worse
  // than no card at all.
  if (scored.length === 0) return null;

  return (
    <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text-primary">Earnings</h3>
        <span
          className="whitespace-nowrap rounded-lg border border-border-primary px-2.5 py-1 font-financial text-sm"
          style={{ color: beats === scored.length ? BEAT_COLOR : undefined }}
          title={`Beat consensus in ${beats} of the last ${scored.length} reported quarters`}
        >
          {beats}/{scored.length} beat
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <BarChart
          className="h-[240px] min-w-[280px]"
          data={rows}
          // The x labels are centred on their band, so the last one needs half
          // its own width of margin or it clips against the card edge.
          margin={{ top: 12, right: 28, bottom: 28, left: 52 }}
          xDataKey="label"
        >
          <Grid horizontal />
          {/* Invisible: present only so both series reach the y-domain. */}
          <Bar animate={false} dataKey="Actual" fill="transparent" />
          <Bar animate={false} dataKey="Estimate" fill="transparent" />
          <SurpriseDots />
          <BarXAxis formatLabel={formatFiscalPeriod} />
          <YAxis formatValue={fmtEps} />
          <ChartTooltip
            rows={(point) => {
              const actual = point.Actual as number | null;
              const estimate = point.Estimate as number | null;
              const out: { color: string; label: string; value: string }[] = [];

              if (actual != null) {
                out.push({
                  color: point.beat === false ? MISS_COLOR : BEAT_COLOR,
                  label: "Actual",
                  value: fmtEps(actual),
                });
              }
              if (estimate != null) {
                out.push({
                  color: ESTIMATE_COLOR,
                  label: "Estimate",
                  value: fmtEps(estimate),
                });
              }
              // Percentages off a near-zero estimate explode into nonsense, so
              // the surprise is shown in cents instead.
              if (actual != null && estimate != null) {
                const diff = actual - estimate;
                out.push({
                  color: diff >= 0 ? BEAT_COLOR : MISS_COLOR,
                  label: diff >= 0 ? "Beat by" : "Missed by",
                  value: fmtEps(Math.abs(diff)),
                });
              }
              return out;
            }}
            showDatePill={false}
            showDots={false}
          />
        </BarChart>
      </div>

      <div className="mt-1 flex items-center justify-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: BEAT_COLOR }}
          />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: ESTIMATE_COLOR }}
          />
          Estimate
        </span>
      </div>
    </div>
  );
}
