"use client";

import type { CotCategory } from "@/types";

interface CotParticipantShareCardProps {
  categories: CotCategory[];
  // Total open interest for the displayed week (CFTC open_interest_all).
  openInterest: number;
  // Open interest within its trailing 3-year range, scaled 0–100 (null if n/a).
  openInterestIndex: number | null;
  title?: string;
}

// Neutral band label for the OI index — describes magnitude, not a bullish/bearish
// signal (high open interest isn't inherently good or bad).
function oiBand(index: number): string {
  if (index >= 80) return "Near 3-yr high";
  if (index <= 20) return "Near 3-yr low";
  return "Mid-range";
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
  openInterestIndex,
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
        Longs / shorts as a share of total OI. Right:{" "}
        <span className="text-oak-300">OI idx</span> = gross position (L+S) within
        its own 3-yr range.
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
            <div className="flex items-center gap-2">
              {/* Two-segment share bar: green = long share, red = short share of OI. */}
              <div className="flex items-center gap-0.5 h-1.5 flex-1">
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
              {/* This category's gross-position (L+S) index within its own 3-yr range. */}
              <div
                className="shrink-0 flex items-center gap-1 w-16"
                title="Gross position (longs + shorts) within its 3-year high/low range"
              >
                <div className="relative h-1.5 flex-1 rounded-full bg-bg-tertiary">
                  {c.openInterestIndex !== null && (
                    <div
                      className="absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oak-300"
                      style={{ left: `${c.openInterestIndex}%` }}
                    />
                  )}
                </div>
                <span className="font-mono text-[10px] text-oak-300 w-4 text-right tabular-nums">
                  {c.openInterestIndex === null ? "—" : Math.round(c.openInterestIndex)}
                </span>
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

      {/* Cumulative (total market) open-interest 3-year index — where current total
          OI sits within its own 3-year range. Neutral (magnitude, not a signal). */}
      <div className="border-t border-border-primary pt-3 mt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-text-secondary">Total OI Index (3-Yr)</span>
          {openInterestIndex === null ? (
            <span className="text-xs text-text-tertiary">— n/a</span>
          ) : (
            <span className="text-xs shrink-0">
              <span className="font-mono text-text-primary">{Math.round(openInterestIndex)}</span>
              <span className="ml-1.5 text-text-secondary">{oiBand(openInterestIndex)}</span>
            </span>
          )}
        </div>
        {/* Track with faint end zones (0–20 / 80–100) + neutral marker. */}
        <div className="relative h-2 rounded-full bg-bg-tertiary">
          <div
            className="absolute inset-y-0 left-0 w-1/5 rounded-l-full bg-text-tertiary"
            style={{ opacity: 0.12 }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/5 rounded-r-full bg-text-tertiary"
            style={{ opacity: 0.12 }}
          />
          {openInterestIndex !== null && (
            <div
              className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oak-300"
              style={{ left: `${openInterestIndex}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
