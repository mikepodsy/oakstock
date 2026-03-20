"use client";

import { useState } from "react";
import type { EconomicEvent } from "@/types";

interface EconomicTableProps {
  data: EconomicEvent[];
}

type SortKey = "date" | "event" | "country" | "impact";

const IMPACT_STYLES: Record<string, string> = {
  High: "bg-red-muted text-red-primary",
  Medium: "bg-yellow-900/20 text-yellow-500",
  Low: "bg-bg-tertiary text-text-tertiary",
};

export function EconomicTable({ data }: EconomicTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
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

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-text-tertiary">
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("event")}>Event{sortIndicator("event")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("country")}>Country{sortIndicator("country")}</th>
            <th className="text-right py-3 px-3 font-medium">Previous</th>
            <th className="text-right py-3 px-3 font-medium">Forecast</th>
            <th className="text-right py-3 px-3 font-medium">Actual</th>
            <th className="text-center py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("impact")}>Impact{sortIndicator("impact")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.event}-${event.date}-${i}`}
              className="border-b border-border-secondary hover:bg-bg-tertiary transition-colors"
            >
              <td className="py-3 px-3 text-text-primary">{event.date}</td>
              <td className="py-3 px-3 text-text-primary font-medium">{event.event}</td>
              <td className="py-3 px-3 text-text-secondary">{event.country}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.previous ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.forecast ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.actual ?? "—"}</td>
              <td className="py-3 px-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_STYLES[event.impact] ?? IMPACT_STYLES.Low}`}>
                  {event.impact}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
