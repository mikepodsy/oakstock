"use client";

import { create } from "zustand";
import type { Watchlist, WatchlistItem } from "@/types";

interface WatchlistStore {
  watchlists: Watchlist[];
  initialized: boolean;
  loading: boolean;

  // Hydration
  loadWatchlists: () => Promise<void>;

  // Watchlist CRUD
  createWatchlist: (name: string) => Promise<string>;
  deleteWatchlist: (id: string) => Promise<void>;

  // Item CRUD
  addItem: (watchlistId: string, item: Omit<WatchlistItem, "id" | "addedAt">) => Promise<void>;
  removeItem: (watchlistId: string, itemId: string) => Promise<void>;
  updateItem: (watchlistId: string, itemId: string, updates: Partial<WatchlistItem>) => Promise<void>;
}

function mapWatchlist(row: Record<string, unknown>): Watchlist {
  const items = ((row.watchlist_items as Record<string, unknown>[]) ?? []).map((i) => ({
    id: i.id as string,
    ticker: i.ticker as string,
    name: i.name as string,
    addedAt: i.added_at as string,
    targetPrice: i.target_price != null ? Number(i.target_price) : undefined,
    notes: i.notes as string | undefined,
  }));

  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    items,
  };
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  watchlists: [],
  initialized: false,
  loading: false,

  loadWatchlists: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/watchlists");
      if (!res.ok) throw new Error("Failed to load watchlists");
      const rows = await res.json();
      set({ watchlists: rows.map(mapWatchlist), initialized: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createWatchlist: async (name) => {
    const res = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create watchlist");
    const row = await res.json();
    const watchlist = mapWatchlist(row);
    set((state) => ({ watchlists: [...state.watchlists, watchlist] }));
    return watchlist.id;
  },

  deleteWatchlist: async (id) => {
    const res = await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete watchlist");
    set((state) => ({
      watchlists: state.watchlists.filter((w) => w.id !== id),
    }));
  },

  addItem: async (watchlistId, item) => {
    const res = await fetch(`/api/watchlists/${watchlistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error("Failed to add watchlist item");
    const newItem: WatchlistItem = await res.json();
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === watchlistId
          ? { ...w, items: [...w.items, newItem] }
          : w
      ),
    }));
  },

  removeItem: async (watchlistId, itemId) => {
    const res = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to remove watchlist item");
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === watchlistId
          ? { ...w, items: w.items.filter((i) => i.id !== itemId) }
          : w
      ),
    }));
  },

  updateItem: async (watchlistId, itemId, updates) => {
    const res = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update watchlist item");
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === watchlistId
          ? {
              ...w,
              items: w.items.map((i) =>
                i.id === itemId ? { ...i, ...updates } : i
              ),
            }
          : w
      ),
    }));
  },
}));
