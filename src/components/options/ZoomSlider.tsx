"use client";

// Vertical zoom for the payoff chart: controls the ± price band around spot.
// Top = zoomed in (narrow range), bottom = zoomed out (wide range). The slider
// is rotated 90° so it reads as a vertical control beside the chart.
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 0.6;

export function ZoomSlider({
  rangePct,
  onChange,
}: {
  rangePct: number;
  onChange: (pct: number) => void;
}) {
  // The native range slider increases left→right; rotating it 180° (via the
  // reversed value below) makes "up" = zoom in. We invert so the top of the
  // column is the smallest range.
  const inverted = ZOOM_MIN + ZOOM_MAX - rangePct;

  return (
    <div className="flex flex-col items-center gap-2 py-2 select-none">
      <span className="text-xs text-text-tertiary">+</span>
      <div className="relative flex-1 flex items-center justify-center">
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={inverted}
          onChange={(e) => onChange(ZOOM_MIN + ZOOM_MAX - Number(e.target.value))}
          className="accent-oak-300 cursor-pointer w-40 -rotate-90"
          aria-label="Chart zoom"
        />
      </div>
      <span className="text-xs text-text-tertiary">−</span>
      <span className="text-xs text-text-secondary font-financial whitespace-nowrap">
        ±{Math.round(rangePct * 100)}%
      </span>
    </div>
  );
}
