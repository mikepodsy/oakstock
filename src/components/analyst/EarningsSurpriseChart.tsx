"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { useChart } from "@/components/charts/chart-context";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { YAxis } from "@/components/charts/y-axis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatFiscalPeriod } from "@/utils/formatters";
import type { EarningsSurprise } from "@/types";

interface EarningsSurpriseChartProps {
  /** Beat/miss history, oldest first. */
  surprises: EarningsSurprise[];
}

const BEAT_COLOR = "var(--green-primary)";
const MISS_COLOR = "var(--red-primary)";
const ESTIMATE_COLOR = "var(--text-tertiary)";

/** Reported quarters in the card. Keeps the dots readable in the column. */
const MAX_REPORTED = 4;

/** Reported quarters in the expanded view — as much as the source has. */
const MAX_REPORTED_EXPANDED = 40;

/** Forward quarters shown — one, so the chart stays about results. */
const MAX_FORECAST = 1;

/** Horizontal room each quarter needs in the card before the dots collide. */
const PX_PER_QUARTER = 40;

/**
 * Narrowest the plot goes before its wrapper scrolls.
 *
 * The y-axis is painted inside the scrolling content, so anything that scrolls
 * loses its scale off the left edge. The expanded view therefore takes this
 * bare floor and fits its quarters to the dialog instead of setting a width
 * per quarter — the dots get tighter, but the axis stays put.
 */
const MIN_PLOT_WIDTH = 280;

const DOT_RADIUS = 5.5;

function fmtEps(v: number): string {
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
}

/**
 * Surprise as a share of the consensus, against its magnitude so a loss-making
 * quarter doesn't invert the sign.
 *
 * Returns null when the estimate rounds to nothing: a two-cent miss against a
 * one-cent consensus is a 200% headline that means nothing.
 */
function surprisePercent(actual: number, estimate: number): number | null {
  if (Math.abs(estimate) < 0.01) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
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
function SurpriseDots({ radius }: { radius: number }) {
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
                r={radius}
                stroke={ESTIMATE_COLOR}
                strokeWidth={1.5}
              />
            )}
            {row.Actual != null && (
              <circle
                cx={cx}
                cy={yScale(row.Actual)}
                fill={row.beat === false ? MISS_COLOR : BEAT_COLOR}
                r={radius}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

SurpriseDots.displayName = "SurpriseDots";

function tooltipRows(point: Record<string, unknown>) {
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
  if (actual != null && estimate != null) {
    const diff = actual - estimate;
    const pct = surprisePercent(actual, estimate);
    out.push({
      color: diff >= 0 ? BEAT_COLOR : MISS_COLOR,
      // One word, so the value stays on one line in the narrow card tooltip.
      label: diff >= 0 ? "Beat" : "Miss",
      // Cents alongside the percentage: the percentage is what people quote,
      // but it swings wildly on a thin consensus, and then the cash figure is
      // the one that still means something.
      value:
        pct == null
          ? fmtEps(Math.abs(diff))
          : `${fmtEps(Math.abs(diff))} · ${Math.abs(pct).toFixed(1)}%`,
    });
  }
  return out;
}

function ChartBody({
  rows,
  heightClass,
  minWidth,
  radius = DOT_RADIUS,
}: {
  rows: Row[];
  heightClass: string;
  /** Floor before the wrapper starts scrolling. */
  minWidth: number;
  radius?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // When there are more quarters than pixels, the newest ones are the point —
  // start hard right rather than parked on history from a decade ago.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rows.length]);

  return (
    // Scrolls on its own once the quarters outnumber the pixels. The floor
    // lives on the wrapper because BarChart itself is always `w-full`.
    <div className="-mx-1 overflow-x-auto px-1" ref={scroller}>
      <div style={{ minWidth }}>
        <BarChart
          className={heightClass}
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
          <SurpriseDots radius={radius} />
          <BarXAxis formatLabel={formatFiscalPeriod} />
          <YAxis formatValue={fmtEps} />
          <ChartTooltip
            formatTitle={formatFiscalPeriod}
            rows={tooltipRows}
            showDatePill={false}
            showDots={false}
          />
        </BarChart>
      </div>
    </div>
  );
}

function Legend() {
  return (
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
  );
}

function BeatPill({ beats, total }: { beats: number; total: number }) {
  return (
    <span
      className="whitespace-nowrap rounded-lg border border-border-primary px-2.5 py-1 font-financial text-sm"
      style={{ color: beats === total ? BEAT_COLOR : undefined }}
      title={`Beat consensus in ${beats} of the last ${total} reported quarters`}
    >
      {beats}/{total} beat
    </span>
  );
}

/** Latest `maxReported` results, plus the next quarter's consensus. */
function selectRows(
  surprises: EarningsSurprise[],
  maxReported: number
): Row[] {
  // Split rather than take a trailing slice: the series carries forward
  // quarters, and letting them push reported ones off the left turns a results
  // chart into a forecast chart.
  const reported = surprises.filter((p) => p.actual != null);
  const forecast = surprises.filter((p) => p.actual == null);

  return [...reported.slice(-maxReported), ...forecast.slice(0, MAX_FORECAST)].map(
    (p) => ({
      label: p.label,
      Actual: p.actual,
      Estimate: p.estimate,
      beat:
        p.actual != null && p.estimate != null ? p.actual >= p.estimate : null,
    })
  );
}

/**
 * Reported EPS against the consensus it was measured against, quarter by
 * quarter — a filled dot for the result, a hollow ring for the estimate.
 *
 * A miss turns the dot red rather than moving it, so beat and miss stay
 * comparable on one scale instead of becoming two charts. The card shows the
 * last four; expanding it reaches back as far as the history goes.
 */
export function EarningsSurpriseChart({
  surprises,
}: EarningsSurpriseChartProps) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => selectRows(surprises, MAX_REPORTED),
    [surprises]
  );
  const allRows = useMemo(
    () => selectRows(surprises, MAX_REPORTED_EXPANDED),
    [surprises]
  );

  const scored = rows.filter((r) => r.beat !== null);
  const scoredAll = allRows.filter((r) => r.beat !== null);

  // Nothing to compare means nothing to show — an axis with no dots is worse
  // than no card at all.
  if (scored.length === 0) return null;

  // Only worth an expand control when it would actually reveal something.
  const canExpand = scoredAll.length > scored.length;

  return (
    <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-text-primary">Earnings</h3>

        <div className="flex items-center gap-2">
          <BeatPill beats={scored.filter((r) => r.beat).length} total={scored.length} />
          {canExpand && (
            <Dialog onOpenChange={setExpanded} open={expanded}>
              <DialogTrigger
                aria-label={`Show all ${scoredAll.length} reported quarters`}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                title={`Show all ${scoredAll.length} reported quarters`}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-[min(1400px,92vw)]">
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-3">
                    Earnings
                    <BeatPill
                      beats={scoredAll.filter((r) => r.beat).length}
                      total={scoredAll.length}
                    />
                  </DialogTitle>
                </DialogHeader>
                <ChartBody
                  heightClass="h-[min(70vh,720px)]"
                  minWidth={MIN_PLOT_WIDTH}
                  radius={DOT_RADIUS + 1}
                  rows={allRows}
                />
                <Legend />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <ChartBody
        heightClass="h-[240px]"
        minWidth={Math.max(MIN_PLOT_WIDTH, rows.length * PX_PER_QUARTER)}
        rows={rows}
      />
      <Legend />
    </div>
  );
}
