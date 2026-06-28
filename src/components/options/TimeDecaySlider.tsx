"use client";

import { addDays, format } from "date-fns";

// Slider from today (0) → expiration (1). The label shows the calendar date the
// `today` payoff curve is being priced at.
export function TimeDecaySlider({
  fraction,
  maxDteDays,
  onChange,
}: {
  fraction: number;
  maxDteDays: number;
  onChange: (f: number) => void;
}) {
  const elapsedDays = Math.round(maxDteDays * fraction);
  const valuationDate = addDays(new Date(), elapsedDays);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-tertiary whitespace-nowrap">Today</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={fraction}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-oak-300 cursor-pointer"
        aria-label="Time decay"
      />
      <span className="text-xs text-text-tertiary whitespace-nowrap">Expiry</span>
      <span className="text-xs text-text-secondary font-financial w-28 text-right">
        {format(valuationDate, "MMM d, yyyy")}
      </span>
    </div>
  );
}
