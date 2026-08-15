import type { AnalystPriceTarget, HistoricalDataPoint } from "@/types";
import { spreadLabels } from "./chartLabels";

/**
 * Geometry for the price-target forecast chart, kept out of the component so
 * the maths is testable — a divide-by-zero here would put NaN into an SVG path
 * and silently blank the chart.
 */

export interface PriceTargetLayout {
  /** Plot box inside the viewBox. */
  padL: number;
  padT: number;
  plotW: number;
  plotH: number;
  /** Forecast horizon as a fraction of the history span. */
  forecastShare: number;
  /** Minimum vertical gap between the right-edge callouts. */
  labelGap: number;
}

export interface PriceTargetCallout {
  key: "high" | "mean" | "low" | "spot";
  /** Percentage move from spot, or "Current" for spot itself. */
  text: string;
  value: number;
  /** Where the label is drawn, after nudging to avoid overlaps. */
  labelY: number;
  solid: boolean;
  positive: boolean;
}

/** A history point in viewBox space, for hit-testing the hover crosshair. */
export interface PlottedPoint {
  x: number;
  y: number;
  close: number;
  /** ISO day, for the hover label. */
  date: string;
}

export interface PriceTargetModel {
  linePath: string;
  areaPath: string;
  conePath: string;
  /** History in draw order, left to right. */
  points: PlottedPoint[];
  anchorX: number;
  anchorY: number;
  endX: number;
  meanY: number;
  spotY: number;
  baselineY: number;
  callouts: PriceTargetCallout[];
  ticks: { x: number; label: string }[];
  pastLabel: string;
  horizonLabel: string;
}

const MS_PER_DAY = 86_400_000;

export function buildPriceTargetModel(
  history: HistoricalDataPoint[],
  target: AnalystPriceTarget,
  currentPrice: number | null,
  layout: PriceTargetLayout
): PriceTargetModel | null {
  const { padL, padT, plotW, plotH, forecastShare, labelGap } = layout;

  const points = history
    .filter((p) => typeof p.close === "number" && Number.isFinite(p.close))
    .map((p) => ({ t: new Date(p.date).getTime(), close: p.close }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  if (points.length < 2) return null;

  const startT = points[0].t;
  const anchorT = points[points.length - 1].t;
  // Every point carrying the same timestamp would collapse the x-scale and put
  // Infinity into every coordinate.
  if (anchorT <= startT) return null;

  const anchorClose = points[points.length - 1].close;
  const spot =
    currentPrice != null && Number.isFinite(currentPrice)
      ? currentPrice
      : anchorClose;

  const endT = anchorT + (anchorT - startT) * forecastShare;

  let lo = Math.min(...points.map((p) => p.close), target.low, target.mean, spot);
  let hi = Math.max(...points.map((p) => p.close), target.high, target.mean, spot);
  // A perfectly flat series has no range to pad proportionally; fall back to a
  // share of the price, then to a flat unit for a zero price.
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= pad;
  hi += pad;

  const x = (t: number) => padL + ((t - startT) / (endT - startT)) * plotW;
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * plotH;

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.close).toFixed(2)}`
    )
    .join(" ");

  const anchorX = x(anchorT);
  const anchorY = y(anchorClose);
  const endX = x(endT);
  const baselineY = padT + plotH;

  const rawCallouts: Omit<PriceTargetCallout, "labelY">[] = [
    {
      key: "high",
      text: pctText(target.high, spot),
      value: target.high,
      solid: true,
      positive: target.high >= spot,
    },
    {
      key: "mean",
      text: pctText(target.mean, spot),
      value: target.mean,
      solid: true,
      positive: target.mean >= spot,
    },
    {
      key: "low",
      text: pctText(target.low, spot),
      value: target.low,
      solid: true,
      positive: target.low >= spot,
    },
    {
      key: "spot",
      text: "Current",
      value: spot,
      solid: false,
      positive: true,
    },
  ];

  const labelYs = spreadLabels(
    rawCallouts.map((c) => y(c.value)),
    labelGap,
    { min: padT + 8, max: baselineY - 8 }
  );

  return {
    linePath,
    points: points.map((p) => ({
      x: x(p.t),
      y: y(p.close),
      close: p.close,
      date: new Date(p.t).toISOString().split("T")[0],
    })),
    areaPath: `${linePath} L ${anchorX.toFixed(2)} ${baselineY.toFixed(2)} L ${padL.toFixed(2)} ${baselineY.toFixed(2)} Z`,
    // A triangle: each target is a straight line from today's price to a single
    // point one horizon out.
    conePath: `M ${anchorX.toFixed(2)} ${anchorY.toFixed(2)} L ${endX.toFixed(2)} ${y(target.high).toFixed(2)} L ${endX.toFixed(2)} ${y(target.low).toFixed(2)} Z`,
    anchorX,
    anchorY,
    endX,
    meanY: y(target.mean),
    spotY: y(spot),
    baselineY,
    callouts: rawCallouts.map((c, i) => ({ ...c, labelY: labelYs[i] })),
    ticks: yearTicks(startT, endT).map((tick) => ({
      x: x(tick.t),
      label: tick.label,
    })),
    pastLabel: spanLabel("PAST", anchorT - startT),
    horizonLabel: `${spanLabel("", endT - anchorT).trim()} FORECAST`,
  };
}

function pctText(value: number, spot: number): string {
  if (!spot) return value.toFixed(2);
  const pct = ((value - spot) / spot) * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

/** Year boundaries inside the span, for the x-axis. */
function yearTicks(startT: number, endT: number): { t: number; label: string }[] {
  const out: { t: number; label: string }[] = [];
  const firstYear = new Date(startT).getUTCFullYear();
  const lastYear = new Date(endT).getUTCFullYear();

  for (let year = firstYear; year <= lastYear; year++) {
    const t = Date.UTC(year, 0, 1);
    if (t >= startT && t <= endT) out.push({ t, label: String(year) });
  }
  return out;
}

function spanLabel(prefix: string, spanMs: number): string {
  const days = spanMs / MS_PER_DAY;
  const body =
    days >= 330
      ? `${Math.round(days / 365)}Y`
      : `${Math.max(1, Math.round(days / 30))}M`;
  return prefix ? `${prefix} ${body}` : body;
}
