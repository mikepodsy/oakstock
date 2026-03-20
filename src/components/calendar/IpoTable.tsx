"use client";

import { useState } from "react";
import type { IpoEvent } from "@/types";
import { Briefcase } from "lucide-react";

interface IpoTableProps {
  data: IpoEvent[];
}

type SortKey = "date" | "symbol" | "company" | "exchange";

export function IpoTable({ data }: IpoTableProps) {
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
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("date")}>Expected Date{sortIndicator("date")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("company")}>Company{sortIndicator("company")}</th>
            <th className="text-left py-3 px-3 font-medium cursor-pointer" onClick={() => handleSort("exchange")}>Exchange{sortIndicator("exchange")}</th>
            <th className="text-right py-3 px-3 font-medium">Price Range</th>
            <th className="text-right py-3 px-3 font-medium">Shares</th>
            <th className="text-right py-3 px-3 font-medium">Market Cap</th>
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
                  <div>
                    <span className="text-text-primary font-medium">{event.company || event.symbol}</span>
                    {event.symbol && <span className="text-text-tertiary text-xs ml-2">{event.symbol}</span>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-3 text-text-secondary">{event.exchange || "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">{event.priceRange ?? "—"}</td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.sharesOffered ? `${(event.sharesOffered / 1e6).toFixed(1)}M` : "—"}
              </td>
              <td className="py-3 px-3 text-right text-text-secondary">
                {event.marketCap ? `$${(event.marketCap / 1e9).toFixed(2)}B` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
