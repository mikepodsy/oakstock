"use client";

import { WatchlistCard } from "./WatchlistCard";
import type { WatchlistItem, QuoteData } from "@/types";

interface WatchlistGridProps {
  watchlistId: string;
  items: WatchlistItem[];
  quotes: Record<string, QuoteData>;
  expandedItemId: string | null;
  onToggleExpand: (itemId: string) => void;
}

export function WatchlistGrid({
  watchlistId,
  items,
  quotes,
  expandedItemId,
  onToggleExpand,
}: WatchlistGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <WatchlistCard
          key={item.id}
          watchlistId={watchlistId}
          item={item}
          quote={quotes[item.ticker]}
          isExpanded={expandedItemId === item.id}
          onToggle={() => onToggleExpand(item.id)}
        />
      ))}
    </div>
  );
}
