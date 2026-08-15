"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, ListPlus, PanelRightClose, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Watchlist, WatchlistItem } from "@/types";
import type { TechnicalRatingResult } from "@/hooks/useTechnicalRating";
import { useQuotes } from "@/hooks/useQuotes";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { TickerSearch } from "@/components/search/TickerSearch";
import { CreateWatchlistDialog } from "@/components/watchlist/CreateWatchlistDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistPicker } from "./WatchlistPicker";
import { SymbolRow } from "./SymbolRow";
import { TechnicalsSummary } from "./TechnicalsSummary";

interface SymbolListPanelProps {
  width: number;
  watchlists: Watchlist[];
  activeWatchlist: Watchlist | undefined;
  items: WatchlistItem[];
  selectedTicker: string | null;
  loading: boolean;
  technicals: TechnicalRatingResult;
  onSelectWatchlist: (id: string) => void;
  onSelectTicker: (ticker: string) => void;
  onCollapse: () => void;
  onOpenTechnicals: () => void;
}

export function SymbolListPanel({
  width,
  watchlists,
  activeWatchlist,
  items,
  selectedTicker,
  loading,
  technicals,
  onSelectWatchlist,
  onSelectTicker,
  onCollapse,
  onOpenTechnicals,
}: SymbolListPanelProps) {
  const addItem = useWatchlistStore((s) => s.addItem);
  const removeItem = useWatchlistStore((s) => s.removeItem);
  const [addOpen, setAddOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // useQuotes sorts its argument in place, so hand it a throwaway array and keep
  // rendering rows from `items` in the user's own order.
  const tickers = useMemo(() => items.map((i) => i.ticker), [items]);
  const { quotes } = useQuotes(tickers);

  // Keep the selected row in view when the selection moves by keyboard.
  // "nearest" leaves an already-visible row alone, so mouse clicks don't jump.
  useEffect(() => {
    if (!selectedTicker) return;
    listRef.current
      ?.querySelector(`[data-ticker="${CSS.escape(selectedTicker)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedTicker]);

  // Switching lists closes the add row — the search box belongs to the list it
  // was opened on.
  function handleSelectWatchlist(id: string) {
    setAddOpen(false);
    onSelectWatchlist(id);
  }

  function handleAdd(result: { ticker: string; name: string }) {
    if (!activeWatchlist) return;

    if (items.find((i) => i.ticker === result.ticker)) {
      toast.error(`${result.ticker} is already in this list`);
      return;
    }

    addItem(activeWatchlist.id, { ticker: result.ticker, name: result.name });
    toast.success(`Added ${result.ticker} to "${activeWatchlist.name}"`);
    setAddOpen(false);
    onSelectTicker(result.ticker);
  }

  function handleRemove(item: WatchlistItem) {
    if (!activeWatchlist) return;
    removeItem(activeWatchlist.id, item.id);
  }

  return (
    <aside
      // Width as a CSS var so the server and client render identical markup and
      // the mobile stack can ignore it entirely.
      style={{ "--panel-w": `${width}px` } as React.CSSProperties}
      className="flex min-h-0 w-full flex-1 flex-col border-t border-border-primary bg-bg-secondary md:w-[var(--panel-w)] md:flex-none md:border-t-0 md:border-l"
    >
      {/* Header: list picker, new list, add symbol, collapse */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border-primary px-2 py-2">
        <WatchlistPicker
          watchlists={watchlists}
          activeWatchlist={activeWatchlist}
          onSelect={handleSelectWatchlist}
        />

        <div className="ml-auto flex shrink-0 items-center">
          <CreateWatchlistDialog onCreated={handleSelectWatchlist}>
            <Button
              variant="ghost"
              size="icon-xs"
              title="New list"
              className="text-text-tertiary hover:text-text-primary"
            >
              <ListPlus className="h-4 w-4" />
            </Button>
          </CreateWatchlistDialog>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setAddOpen((v) => !v)}
            disabled={!activeWatchlist}
            title="Add symbol"
            className="text-text-tertiary hover:text-text-primary"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCollapse}
            title="Hide list"
            className="text-text-tertiary hover:text-text-primary"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add row — mounted only while open so TickerSearch's autoFocus lands
          when the user asks for it, not on every page load. */}
      {addOpen && activeWatchlist && (
        <div
          className="shrink-0 border-b border-border-primary p-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") setAddOpen(false);
          }}
        >
          <TickerSearch onSelect={handleAdd} />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Eye className="mb-3 h-10 w-10 text-oak-300 opacity-60" />
          <p className="mb-1 text-sm text-text-primary">No watchlists yet</p>
          <p className="mb-4 text-xs text-text-secondary">
            Create a list to start flipping through charts.
          </p>
          <CreateWatchlistDialog onCreated={handleSelectWatchlist}>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Create list
            </Button>
          </CreateWatchlistDialog>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="mb-1 text-sm text-text-primary">
            No symbols in &ldquo;{activeWatchlist?.name}&rdquo;
          </p>
          <p className="mb-4 text-xs text-text-secondary">
            Add a few tickers to scan through them.
          </p>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add symbol
          </Button>
        </div>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-[1fr_auto_auto_auto_16px] gap-2 border-b border-border-secondary px-3 py-1.5 text-[11px] uppercase tracking-wide text-text-tertiary">
            <span>Symbol</span>
            <span>Last</span>
            <span>Chg</span>
            <span>Chg%</span>
            <span />
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-label="Scanner symbols"
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {items.map((item) => (
              <SymbolRow
                key={item.id}
                item={item}
                quote={quotes[item.ticker]}
                selected={item.ticker === selectedTicker}
                onSelect={() => onSelectTicker(item.ticker)}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </div>
        </>
      )}

      {/* Pinned below the list, which keeps its own scroll above. */}
      {selectedTicker && (
        <TechnicalsSummary {...technicals} onOpenDetail={onOpenTechnicals} />
      )}
    </aside>
  );
}
