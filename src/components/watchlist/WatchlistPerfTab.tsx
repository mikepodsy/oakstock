"use client";

import { PreviewCard } from "@base-ui/react/preview-card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WATCHLIST_PERIODS,
  type WatchlistPeriod,
  type WatchlistReturns,
} from "@/hooks/useWatchlistPerformance";
import type { Watchlist } from "@/types";

// Periods revealed on hover — everything except the headline (1D).
const HOVER_PERIODS: WatchlistPeriod[] = WATCHLIST_PERIODS.filter((p) => p !== "1D");

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pctColor(value: number | null): string {
  if (value == null) return "text-text-tertiary";
  return value >= 0 ? "text-green-primary" : "text-red-primary";
}

export function WatchlistPerfTab({
  watchlist,
  isSelected,
  onSelect,
  returns,
  loading,
  compact = false,
}: {
  watchlist: Watchlist;
  isSelected: boolean;
  onSelect: () => void;
  returns?: WatchlistReturns;
  loading: boolean;
  compact?: boolean;
}) {
  const today = returns?.["1D"] ?? null;
  const showValue = returns != null && (!loading || today != null);

  const selectedClasses = isSelected
    ? "border-green-primary bg-green-muted"
    : "border-border-primary bg-bg-tertiary hover:border-text-tertiary";

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        delay={200}
        closeDelay={100}
        render={
          compact ? (
            <button
              type="button"
              onClick={onSelect}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-left transition-colors ${selectedClasses}`}
            >
              <span className="truncate text-sm font-medium text-text-primary">
                {watchlist.name}
              </span>
              {showValue ? (
                <span className={`text-xs font-semibold ${pctColor(today)}`}>
                  {formatPct(today)}
                </span>
              ) : (
                <Skeleton className="h-3 w-10" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              className={`flex w-32 shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 text-left transition-colors ${selectedClasses}`}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-sm font-medium text-text-primary">
                  {watchlist.name}
                </span>
                <span className="text-xs text-text-tertiary">{watchlist.items.length}</span>
              </span>
              {showValue ? (
                <span className={`flex items-center gap-0.5 text-sm font-semibold ${pctColor(today)}`}>
                  {today != null &&
                    (today >= 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                  {formatPct(today)}
                </span>
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </button>
          )
        }
      />
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <PreviewCard.Popup className="min-w-[140px] rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 shadow-lg outline-none">
            <div className="mb-1 text-xs font-medium text-text-secondary">{watchlist.name}</div>
            <div className="flex flex-col gap-1">
              {HOVER_PERIODS.map((period) => {
                const value = returns?.[period] ?? null;
                return (
                  <div key={period} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-text-tertiary">{period}</span>
                    <span className={`font-medium ${pctColor(value)}`}>{formatPct(value)}</span>
                  </div>
                );
              })}
            </div>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
