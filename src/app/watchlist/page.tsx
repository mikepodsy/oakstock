"use client";

import { useMemo, useState, useEffect } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { useQuotes } from "@/hooks/useQuotes";
import { TickerSearch } from "@/components/search/TickerSearch";
import { WatchlistGrid } from "@/components/watchlist/WatchlistGrid";
import { CreateWatchlistDialog } from "@/components/watchlist/CreateWatchlistDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function WatchlistPage() {
  const watchlists = useWatchlistStore((s) => s.watchlists);
  const addItem = useWatchlistStore((s) => s.addItem);
  const deleteWatchlist = useWatchlistStore((s) => s.deleteWatchlist);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Auto-select first watchlist if none selected or selected was deleted
  useEffect(() => {
    if (watchlists.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !watchlists.find((w) => w.id === selectedId)) {
      setSelectedId(watchlists[0].id);
    }
  }, [watchlists, selectedId]);

  // Collapse expanded card when switching watchlists
  useEffect(() => {
    setExpandedItemId(null);
  }, [selectedId]);

  const selectedWatchlist = watchlists.find((w) => w.id === selectedId);
  const items = selectedWatchlist?.items ?? [];

  const tickers = useMemo(() => items.map((i) => i.ticker), [items]);
  const { quotes } = useQuotes(tickers);

  function handleAddTicker(result: { ticker: string; name: string }) {
    if (!selectedId) return;

    if (items.find((i) => i.ticker === result.ticker)) {
      toast.error(`${result.ticker} is already in this watchlist`);
      return;
    }

    addItem(selectedId, { ticker: result.ticker, name: result.name });
    toast.success(`Added ${result.ticker} to watchlist`);
  }

  function handleDeleteWatchlist() {
    if (!selectedWatchlist) return;
    deleteWatchlist(selectedWatchlist.id);
    toast.success(`Deleted "${selectedWatchlist.name}"`);
  }

  function handleToggleExpand(itemId: string) {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }

  // No watchlists created yet
  if (watchlists.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-text-primary">Watchlist</h1>
          <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Watchlist
            </Button>
          </CreateWatchlistDialog>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-280px)] px-6 text-center">
          <Eye className="h-16 w-16 text-oak-300 mb-4 opacity-60" />
          <h2 className="font-display text-2xl text-text-primary mb-2">
            No watchlists yet
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-sm">
            Create a watchlist to start tracking stocks you&apos;re interested
            in.
          </p>
          <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Watchlist
            </Button>
          </CreateWatchlistDialog>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-text-primary">Watchlist</h1>
        <CreateWatchlistDialog onCreated={(id) => setSelectedId(id)}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Watchlist
          </Button>
        </CreateWatchlistDialog>
      </div>

      {/* Watchlist Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {watchlists.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedId(w.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              w.id === selectedId
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {w.name}
            <span className="ml-1.5 text-xs opacity-70">
              {w.items.length}
            </span>
          </button>
        ))}

        {selectedWatchlist && (
          <button
            onClick={handleDeleteWatchlist}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-red-primary hover:bg-red-muted transition-colors"
            title={`Delete "${selectedWatchlist.name}"`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <TickerSearch onSelect={handleAddTicker} />
      </div>

      {/* Grid or Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] px-6 text-center">
          <Eye className="h-12 w-12 text-oak-300 mb-4 opacity-60" />
          <h2 className="font-display text-lg text-text-primary mb-2">
            No stocks in &ldquo;{selectedWatchlist?.name}&rdquo;
          </h2>
          <p className="text-text-secondary text-sm max-w-sm">
            Search above to add stocks to this watchlist.
          </p>
        </div>
      ) : (
        <WatchlistGrid
          watchlistId={selectedId!}
          items={items}
          quotes={quotes}
          expandedItemId={expandedItemId}
          onToggleExpand={handleToggleExpand}
        />
      )}
    </div>
  );
}
