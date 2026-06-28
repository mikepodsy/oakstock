"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import type { CrossState, MomentumStatus } from "@/utils/momentum";

function fmtPrice(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

// "crossed today" / "crossed Nd ago" / "no recent cross"
function crossLabel(cross: CrossState): string {
  if (cross.sessionsSinceCross === null) return "no recent cross";
  if (cross.sessionsSinceCross === 0) return "crossed today";
  return `crossed ${cross.sessionsSinceCross}d ago`;
}

// Above/below pill for a price-vs-MA relationship. Fresh same-session crosses
// get a ring + arrow so they stand out.
function RelationBadge({ cross, maNull }: { cross: CrossState; maNull: boolean }) {
  if (maNull) {
    return <span className="text-xs text-text-tertiary">n/a</span>;
  }
  const above = cross.relation === "above";
  const color = above
    ? "bg-green-muted text-green-primary"
    : "bg-red-muted text-red-primary";
  const ring = cross.crossedThisBar ? "ring-2 ring-offset-1 ring-offset-bg-secondary " : "";
  const ringColor = cross.crossedThisBar
    ? above
      ? "ring-green-primary"
      : "ring-red-primary"
    : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color} ${ring}${ringColor}`}
    >
      {above ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {above ? "Above" : "Below"}
    </span>
  );
}

function MaCell({
  ma,
  distancePct,
  cross,
}: {
  ma: number | null;
  distancePct: number;
  cross: CrossState;
}) {
  const maNull = ma === null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums text-text-primary">{fmtPrice(ma)}</span>
        {!maNull && (
          <span
            className={`text-xs tabular-nums ${
              distancePct >= 0 ? "text-green-primary" : "text-red-primary"
            }`}
          >
            {fmtPct(distancePct)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <RelationBadge cross={cross} maNull={maNull} />
        {!maNull && (
          <span
            className={`text-[11px] ${
              cross.crossedThisBar ? "font-semibold text-text-primary" : "text-text-tertiary"
            }`}
          >
            {crossLabel(cross)}
          </span>
        )}
      </div>
    </div>
  );
}

// 50d-vs-200d trend: golden cross (50 above 200) vs death cross.
function TrendCell({ status }: { status: MomentumStatus }) {
  if (status.sma200 === null) {
    return <span className="text-xs text-text-tertiary">n/a</span>;
  }
  const golden = status.cross50v200.relation === "above";
  const cross = status.cross50v200;
  const color = golden
    ? "bg-green-muted text-green-primary"
    : "bg-red-muted text-red-primary";
  const ring = cross.crossedThisBar
    ? `ring-2 ring-offset-1 ring-offset-bg-secondary ${golden ? "ring-green-primary" : "ring-red-primary"} `
    : "";
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color} ${ring}`}>
        {golden ? "Golden" : "Death"}
      </span>
      <span
        className={`text-[11px] ${
          cross.crossedThisBar ? "font-semibold text-text-primary" : "text-text-tertiary"
        }`}
      >
        {cross.crossedThisBar
          ? `${golden ? "Golden" : "Death"} cross today`
          : crossLabel(cross)}
      </span>
    </div>
  );
}

export function MomentumTable({ statuses }: { statuses: MomentumStatus[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border-primary text-xs uppercase tracking-wide text-text-tertiary">
            <th className="px-4 py-3 font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">50d MA</th>
            <th className="px-4 py-3 font-medium">200d MA</th>
            <th className="px-4 py-3 font-medium">50/200 Trend</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => {
            const fresh =
              s.priceVs50.crossedThisBar ||
              s.priceVs200.crossedThisBar ||
              s.cross50v200.crossedThisBar;
            return (
              <tr
                key={s.ticker}
                className={`border-b border-border-primary last:border-0 ${
                  fresh ? "bg-bg-tertiary/40" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span className="font-display text-sm text-text-primary">{s.ticker}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm tabular-nums text-text-primary">{fmtPrice(s.close)}</span>
                </td>
                <td className="px-4 py-3">
                  <MaCell ma={s.sma50} distancePct={s.distance50Pct} cross={s.priceVs50} />
                </td>
                <td className="px-4 py-3">
                  <MaCell ma={s.sma200} distancePct={s.distance200Pct} cross={s.priceVs200} />
                </td>
                <td className="px-4 py-3">
                  <TrendCell status={s} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
