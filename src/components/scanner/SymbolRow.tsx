"use client";

import { memo } from "react";
import { X } from "lucide-react";
import type { QuoteData, WatchlistItem } from "@/types";
import { formatPercent } from "@/utils/formatters";

interface SymbolRowProps {
  item: WatchlistItem;
  quote?: QuoteData;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SymbolRowInner({
  item,
  quote,
  selected,
  onSelect,
  onRemove,
}: SymbolRowProps) {
  const up = (quote?.dayChangePercent ?? 0) >= 0;
  const changeColor = up ? "text-green-primary" : "text-red-primary";

  return (
    <div
      role="option"
      aria-selected={selected}
      data-ticker={item.ticker}
      onClick={onSelect}
      title={item.name}
      className={`group grid cursor-pointer grid-cols-[1fr_auto_auto_auto_16px] items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
        selected
          ? "bg-bg-tertiary text-text-primary"
          : "text-text-secondary hover:bg-bg-tertiary"
      }`}
    >
      <span className="truncate font-financial font-medium text-text-primary">
        {item.ticker}
      </span>

      {quote ? (
        <>
          <span className="font-financial tabular-nums text-text-primary">
            {quote.currentPrice.toFixed(2)}
          </span>
          <span className={`font-financial tabular-nums ${changeColor}`}>
            {up ? "+" : ""}
            {quote.dayChange.toFixed(2)}
          </span>
          <span className={`font-financial tabular-nums ${changeColor}`}>
            {formatPercent(quote.dayChangePercent)}
          </span>
        </>
      ) : (
        <>
          <span className="text-text-tertiary">—</span>
          <span className="text-text-tertiary">—</span>
          <span className="text-text-tertiary">—</span>
        </>
      )}

      {/* stopPropagation, or removing the row also re-selects it. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title={`Remove ${item.ticker}`}
        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 text-text-tertiary hover:text-red-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const SymbolRow = memo(SymbolRowInner);
