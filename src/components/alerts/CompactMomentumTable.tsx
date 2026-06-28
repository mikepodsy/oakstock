"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import type { StoredMomentum } from "@/app/api/alerts/sp400/route";
import type { CrossState } from "@/utils/momentum";
import {
  fmtPrice,
  fmtPct,
  fmtMarketCap,
  crossLabel,
  RelationBadge,
  TrendPill,
} from "./momentumDisplay";

// Dense price-vs-MA cell: distance % (colored by above/below) + compact arrow
// badge. The full "crossed Nd ago" detail is kept on hover via title.
function CompactMaCell({ ma, distancePct, cross }: { ma: number | null; distancePct: number; cross: CrossState }) {
  const maNull = ma === null;
  return (
    <div className="flex items-center gap-1.5" title={maNull ? undefined : crossLabel(cross)}>
      {!maNull && (
        <span
          className={`text-xs tabular-nums ${
            distancePct >= 0 ? "text-green-primary" : "text-red-primary"
          }`}
        >
          {fmtPct(distancePct)}
        </span>
      )}
      <RelationBadge cross={cross} maNull={maNull} compact />
    </div>
  );
}

export function CompactMomentumTable({ statuses }: { statuses: StoredMomentum[] }) {
  return (
    <div className="overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary max-h-[calc(100vh-180px)]">
      <table className="w-full min-w-[440px] text-left">
        <thead className="sticky top-0 z-10 bg-bg-secondary">
          <tr className="border-b border-border-primary text-[11px] uppercase tracking-wide text-text-tertiary">
            <th className="px-3 py-2 font-medium">Stock</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            <th className="px-3 py-2 font-medium">50d</th>
            <th className="px-3 py-2 font-medium">200d</th>
            <th className="px-3 py-2 font-medium">Trend</th>
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
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <CompanyLogo ticker={s.ticker} className="w-5 h-5 rounded" textClassName="text-[8px]" />
                    <div className="flex flex-col leading-tight">
                      <Link
                        href={`/stock/${s.ticker}`}
                        className="font-display text-[13px] text-text-primary hover:text-green-primary transition-colors"
                      >
                        {s.ticker}
                      </Link>
                      <span className="text-[10px] text-text-tertiary">{fmtMarketCap(s.marketCap)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className="text-xs tabular-nums text-text-primary">{fmtPrice(s.close)}</span>
                </td>
                <td className="px-3 py-1.5">
                  <CompactMaCell ma={s.sma50} distancePct={s.distance50Pct} cross={s.priceVs50} />
                </td>
                <td className="px-3 py-1.5">
                  <CompactMaCell ma={s.sma200} distancePct={s.distance200Pct} cross={s.priceVs200} />
                </td>
                <td className="px-3 py-1.5">
                  <div title={s.sma200 === null ? undefined : crossLabel(s.cross50v200)}>
                    <TrendPill cross={s.cross50v200} sma200Null={s.sma200 === null} compact />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
