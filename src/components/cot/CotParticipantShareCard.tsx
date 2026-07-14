"use client";

import type { CotCategory } from "@/types";

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

// Neutral 0–100 gauge track with faint end zones (0–20 / 80–100) + an oak marker.
function OiGaugeTrack({ index }: { index: number | null }) {
  return (
    <div className="relative h-2 rounded-full bg-bg-tertiary">
      <div
        className="absolute inset-y-0 left-0 w-1/5 rounded-l-full bg-text-tertiary"
        style={{ opacity: 0.12 }}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/5 rounded-r-full bg-text-tertiary"
        style={{ opacity: 0.12 }}
      />
      {index !== null && (
        <div
          className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-oak-300"
          style={{ left: `${index}%` }}
        />
      )}
    </div>
  );
}

// Index value + neutral band label (e.g. "62  Mid-range").
function OiValue({ index }: { index: number | null }) {
  if (index === null) return <span className="text-xs text-text-tertiary">— n/a</span>;
  return (
    <span className="text-xs whitespace-nowrap">
      <span className="font-mono text-text-primary">{Math.round(index)}</span>
      <span className="ml-1.5 text-text-secondary">{oiBand(index)}</span>
    </span>
  );
}

interface CotParticipantShareCardProps {
  categories: CotCategory[];
  // Total open interest for the displayed week (CFTC open_interest_all).
  openInterest: number;
  // Total open interest within its trailing 3-year range, scaled 0–100 (null if n/a).
  openInterestIndex: number | null;
  title?: string;
}

// Breakdown of each trader category's long/short positions as a share of total open
// interest, plus a 3-year open-interest index for every category and the market total.
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
        Longs / shorts as a share of total OI. <span className="text-oak-300">OI idx</span>{" "}
        = gross position (L+S) within its own 3-yr range (0–100).
      </p>

      <div className="space-y-4">
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

            {/* This category's 3-year open-interest index (gross position vs its range). */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="shrink-0 w-9 text-[10px] text-oak-300">OI idx</span>
              <div className="flex-1">
                <OiGaugeTrack index={c.openInterestIndex} />
              </div>
              <div className="shrink-0 w-24 text-right">
                <OiValue index={c.openInterestIndex} />
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

      {/* Cumulative (total market) open-interest 3-year index. */}
      <div className="border-t border-border-primary pt-3 mt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-text-secondary">Total OI Index (3-Yr)</span>
          <OiValue index={openInterestIndex} />
        </div>
        <OiGaugeTrack index={openInterestIndex} />
      </div>
    </div>
  );
}
