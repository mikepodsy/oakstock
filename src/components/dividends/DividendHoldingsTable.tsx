"use client";

import { useState } from "react";
import Link from "next/link";
import type { DividendHolding } from "@/types";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

interface DividendHoldingsTableProps {
  holdings: DividendHolding[];
  loading: boolean;
}

type SortKey =
  | "ticker"
  | "portfolioName"
  | "totalShares"
  | "currentPrice"
  | "dividendYield"
  | "annualDividendPerShare"
  | "annualIncome"
  | "yieldOnCost";

export function DividendHoldingsTable({
  holdings,
  loading,
}: DividendHoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("annualIncome");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      const cmp = va.localeCompare(vb);
      return sortAsc ? cmp : -cmp;
    }
    const cmp = (va as number) - (vb as number);
    return sortAsc ? cmp : -cmp;
  });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  if (loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
        <h2 className="text-lg font-display text-text-primary mb-4">
          Dividend Holdings
        </h2>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
      <h2 className="text-lg font-display text-text-primary mb-4">
        Dividend Holdings
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-tertiary">
              <th
                className="text-left py-3 px-3 font-medium cursor-pointer"
                onClick={() => handleSort("ticker")}
              >
                Ticker{sortIndicator("ticker")}
              </th>
              <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">
                Name
              </th>
              <th
                className="text-left py-3 px-3 font-medium cursor-pointer hidden md:table-cell"
                onClick={() => handleSort("portfolioName")}
              >
                Portfolio{sortIndicator("portfolioName")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer"
                onClick={() => handleSort("totalShares")}
              >
                Shares{sortIndicator("totalShares")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer hidden sm:table-cell"
                onClick={() => handleSort("currentPrice")}
              >
                Price{sortIndicator("currentPrice")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer"
                onClick={() => handleSort("dividendYield")}
              >
                Yield{sortIndicator("dividendYield")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer hidden md:table-cell"
                onClick={() => handleSort("annualDividendPerShare")}
              >
                Div/Share{sortIndicator("annualDividendPerShare")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer"
                onClick={() => handleSort("annualIncome")}
              >
                Annual Income{sortIndicator("annualIncome")}
              </th>
              <th
                className="text-right py-3 px-3 font-medium cursor-pointer hidden lg:table-cell"
                onClick={() => handleSort("yieldOnCost")}
              >
                Yield on Cost{sortIndicator("yieldOnCost")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr
                key={`${h.portfolioId}-${h.holdingId}`}
                className="border-b border-border-secondary hover:bg-bg-tertiary transition-colors"
              >
                <td className="py-3 px-3">
                  <Link
                    href={`/stock/${h.ticker}`}
                    className="text-text-primary font-medium hover:text-green-primary transition-colors"
                  >
                    {h.ticker}
                  </Link>
                </td>
                <td className="py-3 px-3 text-text-secondary hidden lg:table-cell">
                  {h.name}
                </td>
                <td className="py-3 px-3 text-text-tertiary text-xs hidden md:table-cell">
                  {h.portfolioName}
                </td>
                <td className="py-3 px-3 text-right text-text-primary font-financial">
                  {h.totalShares.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-text-primary font-financial hidden sm:table-cell">
                  {formatCurrency(h.currentPrice)}
                </td>
                <td className="py-3 px-3 text-right text-green-primary font-financial">
                  {formatPercent(h.dividendYield * 100)}
                </td>
                <td className="py-3 px-3 text-right text-text-primary font-financial hidden md:table-cell">
                  ${h.annualDividendPerShare.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-green-primary font-financial font-medium">
                  {formatCurrency(h.annualIncome)}
                </td>
                <td className="py-3 px-3 text-right text-text-secondary font-financial hidden lg:table-cell">
                  {formatPercent(h.yieldOnCost * 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
