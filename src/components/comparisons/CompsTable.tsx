"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CompRow } from "@/lib/comps/metrics";
import { METRICS, formatMetric, type MetricId } from "@/lib/comps/registry";
import { mean, premium } from "@/lib/comps/stats";
import { goodness, heatColor, okRows, peerMedian } from "./shared";

interface CompsTableProps {
  rows: CompRow[];
  target: string;
  metrics: MetricId[];
  heatmap: boolean;
  activeMetric: MetricId;
  onActiveMetric: (id: MetricId) => void;
  onRemove: (ticker: string) => void;
}

type Sort = { id: MetricId; dir: "asc" | "desc" } | null;

function sortRows(rows: CompRow[], sort: Sort): CompRow[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const av = a.values[sort.id];
    const bv = b.values[sort.id];
    // NM always sinks to the bottom, whichever direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return sort.dir === "asc" ? av - bv : bv - av;
  });
}

export function CompsTable({
  rows,
  target,
  metrics,
  heatmap,
  activeMetric,
  onActiveMetric,
  onRemove,
}: CompsTableProps) {
  const [sort, setSort] = useState<Sort>(null);

  const targetRow = rows.find((r) => r.ticker === target);
  const peers = useMemo(
    () => sortRows(rows.filter((r) => r.ticker !== target), sort),
    [rows, target, sort]
  );
  const peerOk = okRows(peers);

  const clickHeader = (id: MetricId) => {
    onActiveMetric(id);
    setSort((s) =>
      s?.id === id ? (s.dir === "desc" ? { id, dir: "asc" } : null) : { id, dir: "desc" }
    );
  };

  const cell = (row: CompRow, id: MetricId) => (
    <td
      key={id}
      className="px-3 py-2 text-right font-financial tabular-nums whitespace-nowrap"
      style={heatmap && !row.error ? { background: heatColor(goodness(rows, row, id)) } : undefined}
    >
      {row.error ? "—" : (
        <span className={row.values[id] == null ? "text-text-tertiary" : undefined}>
          {formatMetric(row.values[id], METRICS[id].format)}
        </span>
      )}
    </td>
  );

  const companyCell = (row: CompRow, isTarget: boolean) => (
    <td className="sticky left-0 z-10 bg-bg-secondary px-3 py-2">
      <div className="flex items-center gap-2">
        {isTarget ? (
          <span className="h-2 w-2 rounded-full bg-green-primary" aria-hidden />
        ) : (
          <button
            onClick={() => onRemove(row.ticker)}
            className="text-text-tertiary opacity-0 hover:text-red-primary group-hover:opacity-100"
            aria-label={`Remove ${row.ticker}`}
          >
            <X className="size-3" />
          </button>
        )}
        <div className="min-w-0">
          <Link
            href={`/stock/${encodeURIComponent(row.ticker)}`}
            className={`font-medium hover:underline ${isTarget ? "text-green-primary" : "text-text-primary"}`}
          >
            {row.ticker}
          </Link>
          <p className="max-w-[180px] truncate text-[11px] text-text-tertiary" title={row.name}>
            {row.error ? row.error : row.name}
          </p>
        </div>
      </div>
    </td>
  );

  const statRow = (label: string, fn: (id: MetricId) => string, emphasis = false) => (
    <tr className={`border-t border-border-primary ${emphasis ? "text-text-primary" : "text-text-secondary"}`}>
      <td className="sticky left-0 z-10 bg-bg-secondary px-3 py-2 text-xs font-medium">{label}</td>
      {metrics.map((id) => (
        <td key={id} className="px-3 py-2 text-right font-financial text-xs tabular-nums whitespace-nowrap">
          {fn(id)}
        </td>
      ))}
    </tr>
  );

  const premiumText = (id: MetricId) => {
    const p = premium(targetRow?.values[id] ?? null, peerMedian(rows, target, id));
    if (p == null) return "—";
    return `${p >= 0 ? "+" : ""}${(p * 100).toFixed(0)}%`;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-xs text-text-secondary">
            <th className="sticky left-0 z-10 bg-bg-secondary px-3 py-2 text-left font-medium">Company</th>
            {metrics.map((id) => (
              <th
                key={id}
                onClick={() => clickHeader(id)}
                title={METRICS[id].description}
                className={`cursor-pointer select-none px-3 py-2 text-right font-medium whitespace-nowrap hover:text-text-primary ${
                  id === activeMetric ? "text-text-primary underline decoration-oak-300 underline-offset-4" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {METRICS[id].short}
                  {sort?.id === id &&
                    (sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {targetRow && (
            <tr className="group border-b-2 border-border-primary bg-green-primary/5">
              {companyCell(targetRow, true)}
              {metrics.map((id) => cell(targetRow, id))}
            </tr>
          )}
          {peers.map((row) => (
            <tr key={row.ticker} className="group border-t border-border-primary/60 hover:bg-bg-tertiary/40">
              {companyCell(row, false)}
              {metrics.map((id) => cell(row, id))}
            </tr>
          ))}
          {peers.length === 0 && (
            <tr>
              <td colSpan={metrics.length + 1} className="px-3 py-6 text-center text-xs text-text-secondary">
                No peers yet. Add tickers above to compare.
              </td>
            </tr>
          )}
        </tbody>
        {peerOk.length > 0 && (
          <tfoot className="bg-bg-tertiary/30">
            {statRow("Peer median", (id) => formatMetric(peerMedian(rows, target, id), METRICS[id].format), true)}
            {statRow("Peer mean", (id) =>
              formatMetric(mean(peerOk.map((r) => r.values[id])), METRICS[id].format)
            )}
            {statRow(`${target} vs median`, premiumText, true)}
          </tfoot>
        )}
      </table>
    </div>
  );
}
