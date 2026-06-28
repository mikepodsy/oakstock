"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import type { CrossState } from "@/utils/momentum";

export function fmtPrice(v: number | null): string {
  return v === null
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export function fmtMarketCap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

// "crossed today" / "crossed Nd ago" / "no recent cross"
export function crossLabel(cross: CrossState): string {
  if (cross.sessionsSinceCross === null) return "no recent cross";
  if (cross.sessionsSinceCross === 0) return "crossed today";
  return `crossed ${cross.sessionsSinceCross}d ago`;
}

// Above/below pill for a price-vs-MA relationship. Fresh same-session crosses get
// a ring + arrow so they stand out.
export function RelationBadge({
  cross,
  maNull,
  compact = false,
}: {
  cross: CrossState;
  maNull: boolean;
  compact?: boolean;
}) {
  if (maNull) {
    return <span className="text-xs text-text-tertiary">n/a</span>;
  }
  const above = cross.relation === "above";
  const color = above
    ? "bg-green-muted text-green-primary"
    : "bg-red-muted text-red-primary";
  const ring = cross.crossedThisBar
    ? `ring-2 ring-offset-1 ring-offset-bg-secondary ${above ? "ring-green-primary" : "ring-red-primary"} `
    : "";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-medium ${
        compact ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs"
      } ${color} ${ring}`}
    >
      {above ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {compact ? null : above ? "Above" : "Below"}
    </span>
  );
}

// Golden (50 above 200) vs death cross pill.
export function TrendPill({
  cross,
  sma200Null,
  compact = false,
}: {
  cross: CrossState;
  sma200Null: boolean;
  compact?: boolean;
}) {
  if (sma200Null) {
    return <span className="text-xs text-text-tertiary">n/a</span>;
  }
  const golden = cross.relation === "above";
  const color = golden
    ? "bg-green-muted text-green-primary"
    : "bg-red-muted text-red-primary";
  const ring = cross.crossedThisBar
    ? `ring-2 ring-offset-1 ring-offset-bg-secondary ${golden ? "ring-green-primary" : "ring-red-primary"} `
    : "";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full font-medium ${
        compact ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs"
      } ${color} ${ring}`}
    >
      {golden ? "Golden" : "Death"}
    </span>
  );
}
