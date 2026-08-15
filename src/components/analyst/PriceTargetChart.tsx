"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { AnalystPriceTarget, HistoricalDataPoint } from "@/types";
import {
  buildPriceTargetModel,
  type PlottedPoint,
  type PriceTargetLayout,
} from "@/utils/priceTargetModel";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface PriceTargetChartProps {
  history: HistoricalDataPoint[];
  target: AnalystPriceTarget;
  currentPrice: number | null;
}

// A fixed viewBox scaled to the container. Same approach as RatingGauge: the
// text scales with the box, so nothing collides at any width, and there is no
// ResizeObserver to keep in sync.
const VB_W = 900;
const VB_H = 340;
const PAD_L = 6;
const PAD_R = 112; // room for the price callouts down the right edge
const PAD_T = 18;
const PAD_B = 34; // room for the year ticks

const LAYOUT: PriceTargetLayout = {
  padL: PAD_L,
  padT: PAD_T,
  plotW: VB_W - PAD_L - PAD_R,
  plotH: VB_H - PAD_T - PAD_B,
  // 2y of history projects 1y forward, so the split holds whatever period of
  // history actually came back.
  forecastShare: 0.5,
  // At least the pill height, or nudged labels would overlap each other.
  labelGap: 30,
};

const PILL_W = PAD_R - 14;
const PILL_H = 26;

// Hover readout box.
const TIP_W = 150;
const TIP_H = 44;

export function PriceTargetChart({
  history,
  target,
  currentPrice,
}: PriceTargetChartProps) {
  const gradientId = useId();
  const upClipId = `${gradientId}-up`;
  const downClipId = `${gradientId}-down`;

  const [hover, setHover] = useState<PlottedPoint | null>(null);

  const model = useMemo(
    () => buildPriceTargetModel(history, target, currentPrice, LAYOUT),
    [history, target, currentPrice]
  );

  const points = model?.points;
  const anchorX = model?.anchorX;

  const handleMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!points?.length || anchorX == null) return;

      // The SVG is scaled to its container, so client pixels have to be mapped
      // back into viewBox units before they mean anything.
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;

      // The forecast half has no observed prices to report.
      if (vbX > anchorX + 4) {
        setHover(null);
        return;
      }

      let nearest = points[0];
      for (const p of points) {
        if (Math.abs(p.x - vbX) < Math.abs(nearest.x - vbX)) nearest = p;
      }
      setHover(nearest);
    },
    [points, anchorX]
  );

  const clearHover = useCallback(() => setHover(null), []);

  if (!model) {
    return (
      <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-text-tertiary">
        Not enough price history to plot the forecast.
      </div>
    );
  }

  // Sits to the right of the crosshair, flipping left when that would run past
  // the plot's edge and under the callout pills.
  const fitsRight = hover ? hover.x + 10 + TIP_W <= VB_W - PAD_R : true;
  const tipX = !hover
    ? 0
    : fitsRight
      ? hover.x + 10
      : Math.max(PAD_L, hover.x - 10 - TIP_W);
  const tipY = hover
    ? Math.min(Math.max(PAD_T, hover.y - TIP_H - 12), model.baselineY - TIP_H)
    : 0;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full touch-none"
      role="img"
      aria-label={`Price history and analyst target range, ${model.horizonLabel.toLowerCase()}`}
      onPointerMove={handleMove}
      onPointerLeave={clearHover}
      onPointerCancel={clearHover}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--chart-line-primary)"
            stopOpacity="0.28"
          />
          <stop
            offset="100%"
            stopColor="var(--chart-line-primary)"
            stopOpacity="0"
          />
        </linearGradient>

        {/* Splitting the cone at the spot line by clipping, rather than by
            computing the intersection, keeps it correct however the targets
            straddle today's price — including entirely above or below it. */}
        <clipPath id={upClipId}>
          <rect
            x={0}
            y={PAD_T}
            width={VB_W}
            height={Math.max(0, model.spotY - PAD_T)}
          />
        </clipPath>
        <clipPath id={downClipId}>
          <rect
            x={0}
            y={model.spotY}
            width={VB_W}
            height={Math.max(0, model.baselineY - model.spotY)}
          />
        </clipPath>
      </defs>

      {/* Past / forecast split */}
      <line
        x1={model.anchorX}
        y1={PAD_T}
        x2={model.anchorX}
        y2={model.baselineY}
        stroke="var(--border-primary)"
        strokeWidth="1"
      />

      {/* The cone: upside above today's price, downside below it. */}
      <path
        d={model.conePath}
        fill="var(--green-primary)"
        fillOpacity="0.14"
        clipPath={`url(#${upClipId})`}
      />
      <path
        d={model.conePath}
        fill="var(--red-primary)"
        fillOpacity="0.14"
        clipPath={`url(#${downClipId})`}
      />

      <line
        x1={model.anchorX}
        y1={model.anchorY}
        x2={model.endX}
        y2={model.meanY}
        stroke="var(--green-primary)"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />

      {/* Spot, carried across the forecast half so the callouts read against it */}
      <line
        x1={PAD_L}
        y1={model.spotY}
        x2={model.endX}
        y2={model.spotY}
        stroke="var(--chart-line-primary)"
        strokeWidth="1"
        strokeDasharray="3,3"
        opacity="0.5"
      />

      <path d={model.areaPath} fill={`url(#${gradientId})`} />
      <path
        d={model.linePath}
        fill="none"
        stroke="var(--chart-line-primary)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {model.ticks.map((tick) => (
        <text
          key={tick.label}
          x={tick.x}
          y={model.baselineY + 22}
          textAnchor="middle"
          fontSize="13"
          fill="var(--text-tertiary)"
        >
          {tick.label}
        </text>
      ))}

      <text
        x={(PAD_L + model.anchorX) / 2}
        y={model.baselineY - 8}
        textAnchor="middle"
        fontSize="12"
        letterSpacing="0.08em"
        fill="var(--text-tertiary)"
      >
        {model.pastLabel}
      </text>
      <text
        x={(model.anchorX + model.endX) / 2}
        y={model.baselineY - 8}
        textAnchor="middle"
        fontSize="12"
        letterSpacing="0.08em"
        fill="var(--text-tertiary)"
      >
        {model.horizonLabel}
      </text>

      {model.callouts.map((c) => {
        const color = c.solid
          ? c.positive
            ? "var(--green-primary)"
            : "var(--red-primary)"
          : "var(--chart-line-primary)";

        return (
          <g key={c.key}>
            {/* Leader from the true value to the nudged label, so a moved pill
                still points at what it describes. */}
            <line
              x1={model.endX}
              y1={c.key === "spot" ? model.spotY : model.anchorY}
              x2={model.endX}
              y2={c.labelY}
              stroke={color}
              strokeWidth="1"
              opacity="0.35"
            />
            <rect
              x={model.endX + 7}
              y={c.labelY - PILL_H / 2}
              width={PILL_W}
              height={PILL_H}
              rx="7"
              fill={c.solid ? color : "transparent"}
              stroke={c.solid ? "none" : color}
              strokeWidth="1.25"
            />
            <text
              x={model.endX + 7 + PILL_W / 2}
              y={c.labelY + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill={c.solid ? "var(--bg-primary)" : color}
            >
              {c.text}
            </text>
          </g>
        );
      })}

      {/* ── Hover crosshair ─────────────────────────────────────────────── */}
      {hover && (
        <g pointerEvents="none">
          <line
            x1={hover.x}
            y1={PAD_T}
            x2={hover.x}
            y2={model.baselineY}
            stroke="var(--text-tertiary)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <circle
            cx={hover.x}
            cy={hover.y}
            r="4.5"
            fill="var(--chart-line-primary)"
            stroke="var(--bg-primary)"
            strokeWidth="2"
          />
          <rect
            x={tipX}
            y={tipY}
            width={TIP_W}
            height={TIP_H}
            rx="7"
            fill="var(--bg-elevated)"
            stroke="var(--border-primary)"
            strokeWidth="1"
          />
          <text
            x={tipX + 11}
            y={tipY + 19}
            fontSize="15"
            fontWeight="600"
            fill="var(--text-primary)"
          >
            {formatCurrency(hover.close)}
          </text>
          <text
            x={tipX + 11}
            y={tipY + 35}
            fontSize="12"
            fill="var(--text-tertiary)"
          >
            {formatDate(hover.date)}
          </text>
        </g>
      )}
    </svg>
  );
}
