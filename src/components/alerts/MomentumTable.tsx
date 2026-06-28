"use client";

import type { CrossState, MomentumStatus } from "@/utils/momentum";
import {
  fmtPrice,
  fmtPct,
  crossLabel,
  RelationBadge,
  TrendPill,
} from "./momentumDisplay";

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

function TrendCell({ status }: { status: MomentumStatus }) {
  const sma200Null = status.sma200 === null;
  const cross = status.cross50v200;
  const golden = cross.relation === "above";
  return (
    <div className="flex flex-col gap-1">
      <TrendPill cross={cross} sma200Null={sma200Null} />
      {!sma200Null && (
        <span
          className={`text-[11px] ${
            cross.crossedThisBar ? "font-semibold text-text-primary" : "text-text-tertiary"
          }`}
        >
          {cross.crossedThisBar ? `${golden ? "Golden" : "Death"} cross today` : crossLabel(cross)}
        </span>
      )}
    </div>
  );
}

export function MomentumTable({ statuses }: { statuses: MomentumStatus[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
      <table className="w-full min-w-[560px] text-left">
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
