"use client";

import { useId, useMemo } from "react";
import type { AnalystPriceTarget, HistoricalDataPoint } from "@/types";
import {
  buildPriceTargetModel,
  type PriceTargetLayout,
} from "@/utils/priceTargetModel";

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
const PAD_R = 92; // room for the price callouts down the right edge
const PAD_B = 34; // room for the year ticks

const LAYOUT: PriceTargetLayout = {
  padL: 6,
  padT: 18,
  plotW: VB_W - 6 - PAD_R,
  plotH: VB_H - 18 - PAD_B,
  // 2y of history projects 1y forward, so the split holds whatever period of
  // history actually came back.
  forecastShare: 0.5,
  labelGap: 19,
};

const PILL_W = PAD_R - 12;

export function PriceTargetChart({
  history,
  target,
  currentPrice,
}: PriceTargetChartProps) {
  const gradientId = useId();

  const model = useMemo(
    () => buildPriceTargetModel(history, target, currentPrice, LAYOUT),
    [history, target, currentPrice]
  );

  if (!model) {
    return (
      <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-text-tertiary">
        Not enough price history to plot the forecast.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={`Price history and analyst target range, ${model.horizonLabel.toLowerCase()}`}
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
      </defs>

      {/* Past / forecast split */}
      <line
        x1={model.anchorX}
        y1={LAYOUT.padT}
        x2={model.anchorX}
        y2={model.baselineY}
        stroke="var(--border-primary)"
        strokeWidth="1"
      />

      {/* The cone: high and low targets fanning out from today's price. */}
      <path d={model.conePath} fill="var(--green-primary)" fillOpacity="0.14" />
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
        x1={LAYOUT.padL}
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
        x={(LAYOUT.padL + model.anchorX) / 2}
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
              x={model.endX + 6}
              y={c.labelY - 10}
              width={PILL_W}
              height="20"
              rx="5"
              fill={c.solid ? color : "transparent"}
              stroke={c.solid ? "none" : color}
              strokeWidth="1"
            />
            <text
              x={model.endX + 6 + PILL_W / 2}
              y={c.labelY + 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="500"
              fill={c.solid ? "var(--bg-primary)" : color}
            >
              {c.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
