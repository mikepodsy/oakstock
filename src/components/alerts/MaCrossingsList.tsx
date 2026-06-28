"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { StoredMomentum } from "@/app/api/alerts/sp400/route";
import type { CrossState } from "@/utils/momentum";
import { recentCrossDirection, RECENT_CROSS_WINDOW } from "@/utils/momentum";
import { fmtPrice, crossLabel } from "./momentumDisplay";

type MaFilter = "50" | "200" | "both";
type DirFilter = "up" | "down" | "both";

interface Crossing {
  ma: "50d" | "200d";
  dir: "up" | "down";
  cross: CrossState;
}

interface CrossingRow {
  stock: StoredMomentum;
  crossings: Crossing[];
  /** Smallest sessionsSinceCross across the row's matching crossings (for sorting). */
  freshest: number;
}

const MA_OPTIONS: { value: MaFilter; label: string }[] = [
  { value: "50", label: "50d" },
  { value: "200", label: "200d" },
  { value: "both", label: "Both" },
];

const DIR_OPTIONS: { value: DirFilter; label: string }[] = [
  { value: "up", label: "Rose ↑" },
  { value: "down", label: "Fell ↓" },
  { value: "both", label: "Both" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-bg-tertiary text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Small MA-tagged direction badge: "50d ↑" (green) / "200d ↓" (red).
function CrossingBadge({ crossing }: { crossing: Crossing }) {
  const up = crossing.dir === "up";
  const color = up ? "bg-green-muted text-green-primary" : "bg-red-muted text-red-primary";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[11px] font-medium ${color}`}
      title={crossLabel(crossing.cross)}
    >
      {crossing.ma}
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
    </span>
  );
}

export function MaCrossingsList({ statuses }: { statuses: StoredMomentum[] }) {
  const [maFilter, setMaFilter] = useState<MaFilter>("both");
  const [dirFilter, setDirFilter] = useState<DirFilter>("both");

  const rows = useMemo<CrossingRow[]>(() => {
    const dirMatches = (dir: "up" | "down") => dirFilter === "both" || dirFilter === dir;
    const includes50 = maFilter === "50" || maFilter === "both";
    const includes200 = maFilter === "200" || maFilter === "both";

    const out: CrossingRow[] = [];
    for (const stock of statuses) {
      const crossings: Crossing[] = [];

      if (includes50) {
        const dir = recentCrossDirection(stock.priceVs50);
        if (dir && dirMatches(dir)) crossings.push({ ma: "50d", dir, cross: stock.priceVs50 });
      }
      if (includes200) {
        const dir = recentCrossDirection(stock.priceVs200);
        if (dir && dirMatches(dir)) crossings.push({ ma: "200d", dir, cross: stock.priceVs200 });
      }

      if (crossings.length === 0) continue;

      const freshest = Math.min(
        ...crossings.map((c) => c.cross.sessionsSinceCross ?? Number.POSITIVE_INFINITY)
      );
      out.push({ stock, crossings, freshest });
    }

    out.sort((a, b) => {
      if (a.freshest !== b.freshest) return a.freshest - b.freshest;
      return (b.stock.marketCap ?? 0) - (a.stock.marketCap ?? 0);
    });
    return out;
  }, [statuses, maFilter, dirFilter]);

  const maLabel = maFilter === "both" ? "50d or 200d MA" : `${maFilter}d MA`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented options={MA_OPTIONS} value={maFilter} onChange={setMaFilter} ariaLabel="Moving average" />
        <Segmented options={DIR_OPTIONS} value={dirFilter} onChange={setDirFilter} ariaLabel="Direction" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-6 text-sm text-text-secondary">
          No stocks crossed their {maLabel} in the last {RECENT_CROSS_WINDOW} trading days.
        </div>
      ) : (
        <div className="overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary max-h-[420px]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-bg-secondary">
              <tr className="border-b border-border-primary text-[11px] uppercase tracking-wide text-text-tertiary">
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium">Crossed</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ stock, crossings, freshest }) => (
                <tr key={stock.ticker} className="border-b border-border-primary last:border-0">
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/stock/${stock.ticker}`}
                      className="font-display text-[13px] text-text-primary hover:text-green-primary transition-colors"
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="text-xs tabular-nums text-text-primary">{fmtPrice(stock.close)}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {crossings.map((c) => (
                        <CrossingBadge key={c.ma} crossing={c} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-[11px] text-text-tertiary">
                      {freshest === 0 ? "today" : `${freshest}d ago`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
