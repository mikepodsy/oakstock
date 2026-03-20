"use client";

import { useState } from "react";
import type { EarningsEvent } from "@/types";
import { Briefcase } from "lucide-react";

interface EarningsTableProps {
  data: EarningsEvent[];
}

type SortKey = "date" | "symbol" | "epsEstimated" | "epsActual" | "revenueEstimated";

export function EarningsTable({ data }: EarningsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("symbol")}>Company{sortIndicator("symbol")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("epsEstimated")}>EPS Est.{sortIndicator("epsEstimated")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("epsActual")}>EPS Actual{sortIndicator("epsActual")}</th>
            <th className="text-right py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("revenueEstimated")}>Revenue Est.{sortIndicator("revenueEstimated")}</th>
            <th className="text-center py-3 px-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.symbol}-${event.date}-${i}`}
              className={`border-b border-border-secondary hover:bg-bg-tertiary transition-colors ${
                event.isPortfolioStock ? "bg-bg-elevated border-l-2 border-l-green-primary" : ""
              }`}
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {event.isPortfolioStock && <Briefcase className="h-3.5 w-3.5 text-green-primary" />}
                  <span className="text-text-primary font-medium">{event.symbol}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.epsEstimated?.toFixed(2) ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.epsActual?.toFixed(2) ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.revenueEstimated ? `$${(event.revenueEstimated / 1e9).toFixed(2)}B` : "—"}
              </td>
              <td className="py-3 px-3 text-center">
                {event.time && (
                  <span className="text-xs bg-bg-tertiary text-text-secondary px-2 py-0.5 rounded-full uppercase">
                    {event.time}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
