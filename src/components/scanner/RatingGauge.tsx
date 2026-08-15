"use client";

import { ratingColor, ratingLabel, type Rating } from "@/utils/technicalRating";

// Semicircular gauge: five fixed zones spanning a −1…1 score, all drawn in the
// border colour except the one the needle is sitting in. Deliberately knows
// nothing about technicals — the analyst rating gauge is the same shape.
//
// The viewBox is wider than the arc on purpose. Every zone label sits on one
// line with clearance from the arc, so nothing wraps mid-phrase or collides.

const CX = 150;
const CY = 124;
const R = 92;
const ARC_WIDTH = 10;

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

// x / y / text-anchor per zone. The two extremes sit below the arc's ends so
// they have the full width of the viewBox to spread into.
const ZONE_LABELS: {
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}[] = [
  { text: "Strong sell", x: 2, y: 146, anchor: "start" },
  { text: "Sell", x: 62, y: 44, anchor: "middle" },
  { text: "Neutral", x: 150, y: 20, anchor: "middle" },
  { text: "Buy", x: 238, y: 44, anchor: "middle" },
  { text: "Strong buy", x: 298, y: 146, anchor: "end" },
];

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
  const [nx, ny] = pointAt(angleOf(score), R - 22);

  return (
    <div className="flex w-full flex-col items-center">
      {title && (
        <span className="mb-2 text-sm font-medium text-text-secondary">
          {title}
        </span>
      )}

      <svg
        viewBox="0 0 300 156"
        className={`w-full ${size === "lg" ? "max-w-[300px]" : "max-w-[228px]"}`}
        role="img"
        aria-label={`${title ? `${title}: ` : ""}${ratingLabel(rating)}`}
      >
        {ZONE_ORDER.map((zone, i) => (
          <path
            key={zone}
            d={arcPath(ZONE_EDGES[i], ZONE_EDGES[i + 1])}
            fill="none"
            strokeWidth={ARC_WIDTH}
            strokeLinecap="butt"
            stroke={i === activeIndex ? color : "var(--border-primary)"}
          />
        ))}

        <g fontSize={13}>
          {ZONE_LABELS.map((label, i) => (
            <text
              key={label.text}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={i === activeIndex ? color : "var(--text-tertiary)"}
            >
              {label.text}
            </text>
          ))}
        </g>

        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="var(--text-primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill="var(--text-primary)" />
      </svg>

      <span
        className={`mt-1 whitespace-nowrap font-medium ${
          size === "lg" ? "text-xl" : "text-base"
        }`}
        style={{ color }}
      >
        {ratingLabel(rating)}
      </span>
    </div>
  );
}
