"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { HoldingWithQuote } from "@/types";
import { formatCurrency, formatPercent, formatDate } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { toast } from "sonner";

type SortKey =
  | "ticker"
  | "totalShares"
  | "avgCostBasis"
  | "currentPrice"
  | "marketValue"
  | "gainLoss"
  | "gainLossPercent"
  | "dayChangePercent";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "totalShares", label: "Shares", align: "right" },
  { key: "avgCostBasis", label: "Avg Cost", align: "right" },
  { key: "currentPrice", label: "Price", align: "right" },
  { key: "marketValue", label: "Market Value", align: "right" },
  { key: "gainLoss", label: "Gain/Loss", align: "right" },
  { key: "gainLossPercent", label: "G/L %", align: "right" },
  { key: "dayChangePercent", label: "Day %", align: "right" },
];

export function HoldingsTable({
  holdings,
  portfolioId,
}: {
  holdings: HoldingWithQuote[];
  portfolioId: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const removeHolding = usePortfolioStore((s) => s.removeHolding);
  const removeLot = usePortfolioStore((s) => s.removeLot);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "ticker");
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const na = Number(va) || 0;
    const nb = Number(vb) || 0;
    return sortAsc ? na - nb : nb - na;
  });

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-secondary">
              <th className="w-8 px-3 py-3" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none ${col.align === "right" ? "text-right" : "text-left"}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-green-primary">
                      {sortAsc ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </th>
              ))}
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const isExpanded = expandedId === h.id;
              return (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : h.id)
                  }
                  onRemoveHolding={() => {
                    removeHolding(portfolioId, h.id);
                    toast.success(`Removed ${h.ticker}`);
                  }}
                  onRemoveLot={(lotId) => {
                    removeLot(portfolioId, h.id, lotId);
                    toast.success("Lot removed");
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {holdings.length === 0 && (
        <div className="p-8 text-center text-text-tertiary text-sm">
          No holdings yet. Add your first holding to get started.
        </div>
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  isExpanded,
  onToggle,
  onRemoveHolding,
  onRemoveLot,
}: {
  holding: HoldingWithQuote;
  isExpanded: boolean;
  onToggle: () => void;
  onRemoveHolding: () => void;
  onRemoveLot: (lotId: string) => void;
}) {
  const router = useRouter();
  const h = holding;
  const glColor = h.gainLoss >= 0 ? "text-green-primary" : "text-red-primary";
  const dcColor =
    h.dayChangePercent >= 0 ? "text-green-primary" : "text-red-primary";

  return (
    <>
      <tr
        className="border-b border-border-secondary hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-3 text-text-tertiary">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-3 py-3">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/stock/${h.ticker}`);
            }}
          >
            <span className="font-financial font-medium text-text-primary hover:text-green-primary transition-colors">
              {h.ticker}
            </span>
            <span className="block text-xs text-text-tertiary truncate max-w-[140px]">
              {h.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {h.totalShares.toFixed(h.totalShares % 1 === 0 ? 0 : 3)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.avgCostBasis)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.currentPrice)}
        </td>
        <td className="px-3 py-3 text-right font-financial text-text-primary">
          {formatCurrency(h.marketValue)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${glColor}`}>
          {formatCurrency(h.gainLoss)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${glColor}`}>
          {formatPercent(h.gainLossPercent)}
        </td>
        <td className={`px-3 py-3 text-right font-financial ${dcColor}`}>
          {formatPercent(h.dayChangePercent)}
        </td>
        <td className="px-3 py-3">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-text-tertiary hover:text-red-primary"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveHolding();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={10} className="bg-bg-tertiary/30 px-6 py-3">
            <div className="text-xs text-text-secondary mb-2 font-medium">
              Lots
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-tertiary">
                  <th className="text-left py-1 pr-4">Purchase Date</th>
                  <th className="text-right py-1 pr-4">Shares</th>
                  <th className="text-right py-1 pr-4">Cost/Share</th>
                  <th className="text-right py-1 pr-4">Total Cost</th>
                  <th className="text-right py-1 pr-4">Current Value</th>
                  <th className="text-right py-1 pr-4">Gain/Loss</th>
                  <th className="w-8 py-1" />
                </tr>
              </thead>
              <tbody>
                {h.lots.map((lot) => {
                  const lotValue = lot.shares * h.currentPrice;
                  const lotCost = lot.shares * lot.costPerShare;
                  const lotGL = lotValue - lotCost;
                  const lotGLColor =
                    lotGL >= 0 ? "text-green-primary" : "text-red-primary";

                  return (
                    <tr
                      key={lot.id}
                      className="border-t border-border-secondary/50"
                    >
                      <td className="py-1.5 pr-4 text-text-primary">
                        {formatDate(lot.purchaseDate)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {lot.shares}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lot.costPerShare)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lotCost)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-financial text-text-primary">
                        {formatCurrency(lotValue)}
                      </td>
                      <td
                        className={`py-1.5 pr-4 text-right font-financial ${lotGLColor}`}
                      >
                        {formatCurrency(lotGL)}
                      </td>
                      <td className="py-1.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-text-tertiary hover:text-red-primary"
                          onClick={() => onRemoveLot(lot.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {h.sector && (
              <div className="mt-2 text-xs text-text-tertiary">
                Sector: {h.sector}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
