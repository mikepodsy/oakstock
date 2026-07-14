"use client";

import type { CotCategory } from "@/types";

interface CotParticipantShareCardProps {
  categories: CotCategory[];
  // Total open interest for the displayed week (CFTC open_interest_all).
  openInterest: number;
  title?: string;
}

// Format a fraction (0..1) of open interest as a one-decimal percentage.
// Returns "—" when open interest is unavailable so we never divide by zero.
function sharePct(value: number, openInterest: number): string {
  if (!openInterest) return "—";
  return `${((value / openInterest) * 100).toFixed(1)}%`;
}

// Width for the mini bar segments — clamp so an outlier week can't overflow the row.
function barWidth(value: number, openInterest: number): string {
  if (!openInterest) return "0%";
  return `${Math.min(Math.max((value / openInterest) * 100, 0), 100)}%`;
}

// Compact breakdown of each trader category's long/short positions as a share of
// total open interest — the CFTC "Percent of Open Interest for Each Category" view.
// Presentational only; the parent drives which week's categories/OI are passed in.
export function CotParticipantShareCard({
  categories,
  openInterest,
  title = "% of Open Interest",
}: CotParticipantShareCardProps) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <span className="text-xs font-mono text-text-secondary shrink-0">
          OI {openInterest ? openInterest.toLocaleString() : "—"}
        </span>
      </div>
      <p className="text-xs text-text-tertiary mb-4">
        Each category&apos;s longs / shorts as a share of total open interest.
      </p>

      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs text-text-primary truncate">{c.name}</span>
              <span className="text-xs font-mono shrink-0">
                <span className="text-green-primary">{sharePct(c.longs, openInterest)}</span>
                <span className="text-text-tertiary"> / </span>
                <span className="text-red-primary">{sharePct(c.shorts, openInterest)}</span>
              </span>
            </div>
            {/* Two-segment share bar: green = long share, red = short share of OI. */}
            <div className="flex items-center gap-0.5 h-1.5">
              <div className="flex-1 flex justify-end bg-bg-tertiary rounded-l-sm overflow-hidden">
                <div
                  className="h-1.5 bg-green-primary rounded-l-sm"
                  style={{ width: barWidth(c.longs, openInterest) }}
                />
              </div>
              <div className="flex-1 flex justify-start bg-bg-tertiary rounded-r-sm overflow-hidden">
                <div
                  className="h-1.5 bg-red-primary rounded-r-sm"
                  style={{ width: barWidth(c.shorts, openInterest) }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm bg-green-primary" />
          Long
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-primary" />
          Short
        </span>
      </div>
    </div>
  );
}
