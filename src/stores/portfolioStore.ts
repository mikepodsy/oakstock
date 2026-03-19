"use client";

import { create } from "zustand";
import type { Portfolio, Holding, Lot } from "@/types";

interface PortfolioStore {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  initialized: boolean;
  loading: boolean;

  // Hydration
  loadPortfolios: () => Promise<void>;

  // Portfolio CRUD
  createPortfolio: (name: string, description?: string, benchmark?: string) => Promise<void>;
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  setActivePortfolio: (id: string | null) => void;

  // Holding CRUD
  addHolding: (portfolioId: string, holding: Omit<Holding, "id">) => Promise<void>;
  updateHolding: (portfolioId: string, holdingId: string, updates: Partial<Holding>) => Promise<void>;
  removeHolding: (portfolioId: string, holdingId: string) => Promise<void>;

  // Lot CRUD
  addLot: (portfolioId: string, holdingId: string, lot: Omit<Lot, "id">) => Promise<void>;
  updateLot: (portfolioId: string, holdingId: string, lotId: string, updates: Partial<Lot>) => Promise<void>;
  removeLot: (portfolioId: string, holdingId: string, lotId: string) => Promise<void>;
}

// Map DB rows (snake_case + nested arrays) → app types (camelCase)
function mapPortfolio(row: Record<string, unknown>): Portfolio {
  const holdings = ((row.holdings as Record<string, unknown>[]) ?? []).map((h) => ({
    id: h.id as string,
    ticker: h.ticker as string,
    name: h.name as string,
    currency: h.currency as "USD" | "CAD",
    notes: h.notes as string | undefined,
    lots: ((h.lots as Record<string, unknown>[]) ?? []).map((l) => ({
      id: l.id as string,
      shares: Number(l.shares),
      costPerShare: Number(l.cost_per_share),
      purchaseDate: l.purchase_date as string,
      notes: l.notes as string | undefined,
    })),
  }));

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    benchmark: row.benchmark as string,
    createdAt: row.created_at as string,
    holdings,
  };
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  portfolios: [],
  activePortfolioId: null,
  initialized: false,
  loading: false,

  loadPortfolios: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/portfolios");
      if (!res.ok) throw new Error("Failed to load portfolios");
      const rows = await res.json();
      const portfolios = rows.map(mapPortfolio);
      set({
        portfolios,
        initialized: true,
        loading: false,
        activePortfolioId: portfolios.length > 0 ? portfolios[0].id : null,
      });
    } catch {
      set({ loading: false });
    }
  },

  createPortfolio: async (name, description, benchmark = "SPY") => {
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, benchmark }),
    });
    if (!res.ok) throw new Error("Failed to create portfolio");
    const row = await res.json();
    const portfolio = mapPortfolio(row);
    set((state) => ({
      portfolios: [...state.portfolios, portfolio],
      activePortfolioId: state.activePortfolioId ?? portfolio.id,
    }));
  },

  updatePortfolio: async (id, updates) => {
    const res = await fetch(`/api/portfolios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update portfolio");
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  deletePortfolio: async (id) => {
    const res = await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete portfolio");
    set((state) => {
      const remaining = state.portfolios.filter((p) => p.id !== id);
      return {
        portfolios: remaining,
        activePortfolioId:
          state.activePortfolioId === id
            ? (remaining[0]?.id ?? null)
            : state.activePortfolioId,
      };
    });
  },

  setActivePortfolio: (id) => set({ activePortfolioId: id }),

  addHolding: async (portfolioId, holding) => {
    const res = await fetch(`/api/portfolios/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holding),
    });
    if (!res.ok) throw new Error("Failed to add holding");
    const row = await res.json();
    const newHolding: Holding = {
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      currency: row.currency,
      notes: row.notes,
      lots: Array.isArray(row.lots) ? row.lots : [],
    };
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? { ...p, holdings: [...p.holdings, newHolding] }
          : p
      ),
    }));
  },

  updateHolding: async (portfolioId, holdingId, updates) => {
    const res = await fetch(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update holding");
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              holdings: p.holdings.map((h) =>
                h.id === holdingId ? { ...h, ...updates } : h
              ),
            }
          : p
      ),
    }));
  },

  removeHolding: async (portfolioId, holdingId) => {
    const res = await fetch(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to remove holding");
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? { ...p, holdings: p.holdings.filter((h) => h.id !== holdingId) }
          : p
      ),
    }));
  },

  addLot: async (portfolioId, holdingId, lot) => {
    const res = await fetch(
      `/api/portfolios/${portfolioId}/holdings/${holdingId}/lots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lot),
      }
    );
    if (!res.ok) throw new Error("Failed to add lot");
    const newLot: Lot = await res.json();
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              holdings: p.holdings.map((h) =>
                h.id === holdingId
                  ? { ...h, lots: [...h.lots, newLot] }
                  : h
              ),
            }
          : p
      ),
    }));
  },

  updateLot: async (portfolioId, holdingId, lotId, updates) => {
    const res = await fetch(
      `/api/portfolios/${portfolioId}/holdings/${holdingId}/lots/${lotId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );
    if (!res.ok) throw new Error("Failed to update lot");
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              holdings: p.holdings.map((h) =>
                h.id === holdingId
                  ? {
                      ...h,
                      lots: h.lots.map((l) =>
                        l.id === lotId ? { ...l, ...updates } : l
                      ),
                    }
                  : h
              ),
            }
          : p
      ),
    }));
  },

  removeLot: async (portfolioId, holdingId, lotId) => {
    const res = await fetch(
      `/api/portfolios/${portfolioId}/holdings/${holdingId}/lots/${lotId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Failed to remove lot");
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              holdings: p.holdings.map((h) =>
                h.id === holdingId
                  ? { ...h, lots: h.lots.filter((l) => l.id !== lotId) }
                  : h
              ),
            }
          : p
      ),
    }));
  },
}));
