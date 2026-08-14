"use client";

import { ratingColor, ratingLabel, type Rating } from "@/utils/technicalRating";

// Semicircular gauge: five fixed zones spanning a −1…1 score, all drawn in the
// border colour except the one the needle is sitting in. Deliberately knows
// nothing about technicals — the analyst rating gauge is the same shape.

const CX = 120;
const CY = 112;
const R = 80;

// Zone edges in score space, left (strong sell) to right (strong buy). These
// are the same cuts ratingFromScore uses.
const ZONE_EDGES = [-1, -0.5, -0.1, 0.1, 0.5, 1];
const ZONE_ORDER: Rating[] = ["strongSell", "sell", "neutral", "buy", "strongBuy"];

/** Score −1…1 → degrees, with −1 at the left end of the arc and 1 at the right. */
function angleOf(score: number): number {
  const clamped = Math.max(-1, Math.min(1, score));
  return 180 - (clamped + 1) * 90;
}

function pointAt(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)];
}

function arcPath(fromScore: number, toScore: number): string {
  const [x1, y1] = pointAt(angleOf(fromScore), R);
  const [x2, y2] = pointAt(angleOf(toScore), R);
  // Sweep 1 = clockwise on screen, i.e. over the top of the arc.
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

interface RatingGaugeProps {
  score: number;
  rating: Rating;
  size?: "sm" | "lg";
  /** Small caption above the gauge, e.g. "Oscillators". */
  title?: string;
}

export function RatingGauge({
  score,
  rating,
  size = "sm",
  title,
}: RatingGaugeProps) {
  const activeIndex = ZONE_ORDER.indexOf(rating);
  const color = ratingColor(rating);
  const [nx, ny] = pointAt(angleOf(score), R - 18);
  const labelSize = size === "lg" ? 12 : 11;
  const verdictClass =
    size === "lg" ? "text-lg font-medium" : "text-sm font-medium";

  return (
    <div className="flex flex-col items-center">
      {title && (
        <span className="mb-1 text-xs text-text-secondary">{title}</span>
      )}

      <svg
        viewBox="0 0 240 140"
        className={size === "lg" ? "w-full max-w-[280px]" : "w-full max-w-[200px]"}
        role="img"
        aria-label={`${title ? `${title}: ` : ""}${ratingLabel(rating)}`}
      >
        {ZONE_ORDER.map((zone, i) => (
          <path
            key={zone}
            d={arcPath(ZONE_EDGES[i], ZONE_EDGES[i + 1])}
            fill="none"
            strokeWidth={9}
            strokeLinecap="butt"
            stroke={i === activeIndex ? color : "var(--border-primary)"}
          />
        ))}

        {/* Zone labels, positioned to sit outside the arc like the reference. */}
        <g fill="var(--text-tertiary)" fontSize={labelSize}>
          <text x={10} y={96} textAnchor="start" fill={activeIndex === 0 ? color : undefined}>
            <tspan x={10}>Strong</tspan>
            <tspan x={10} dy={13}>
              sell
            </tspan>
          </text>
          <text x={50} y={44} textAnchor="middle" fill={activeIndex === 1 ? color : undefined}>
            Sell
          </text>
          <text x={120} y={18} textAnchor="middle" fill={activeIndex === 2 ? color : undefined}>
            Neutral
          </text>
          <text x={190} y={44} textAnchor="middle" fill={activeIndex === 3 ? color : undefined}>
            Buy
          </text>
          <text x={230} y={96} textAnchor="end" fill={activeIndex === 4 ? color : undefined}>
            <tspan x={230}>Strong</tspan>
            <tspan x={230} dy={13}>
              buy
            </tspan>
          </text>
        </g>

        {/* Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="var(--text-primary)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={4} fill="var(--text-primary)" />
      </svg>

      <span className={verdictClass} style={{ color }}>
        {ratingLabel(rating)}
      </span>
    </div>
  );
}
