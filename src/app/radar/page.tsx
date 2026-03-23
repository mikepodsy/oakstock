"use client";

import { useMemo, useState, useEffect } from "react";
import { LayoutGrid, List, ChevronDown, Search, X } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { RadarGrid, type RadarViewMode } from "@/components/radar/RadarGrid";
import {
  RADAR_SECTORS,
  RADAR_SECTOR_KEYS,
  RADAR_ETF_CATEGORIES,
  RADAR_ETF_CATEGORY_KEYS,
} from "@/utils/constants";

type ActiveTab = "stocks" | "etfs";

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("stocks");
  const [selectedSector, setSelectedSector] = useState(RADAR_SECTOR_KEYS[0]);
  const [selectedEtfCategory, setSelectedEtfCategory] = useState(
    RADAR_ETF_CATEGORY_KEYS[0]
  );
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<RadarViewMode>("cards");
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
  const [etfDropdownOpen, setEtfDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const stockTickers = useMemo(
    () => RADAR_SECTORS[selectedSector].tickers,
    [selectedSector]
  );
  const etfTickers = useMemo(
    () => RADAR_ETF_CATEGORIES[selectedEtfCategory].tickers,
    [selectedEtfCategory]
  );

  const activeTickers = activeTab === "stocks" ? stockTickers : etfTickers;
  const { quotes, loading } = useQuotes(activeTickers as unknown as string[]);

  // Reset expanded card and search on navigation
  useEffect(() => {
    setExpandedTicker(null);
    setSearchQuery("");
  }, [selectedSector, selectedEtfCategory, activeTab]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!sectorDropdownOpen && !etfDropdownOpen) return;
    const handler = () => {
      setSectorDropdownOpen(false);
      setEtfDropdownOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [sectorDropdownOpen, etfDropdownOpen]);

  const tickerItems = useMemo(() => {
    const items = activeTickers.map((t) => ({
      ticker: t,
      name: quotes[t]?.name ?? t,
    }));
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [activeTickers, quotes, searchQuery]);

  function handleToggleExpand(ticker: string) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Radar</h1>
          <p className="text-sm text-text-secondary mt-1">
            Discover stocks and ETFs by sector and theme
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "cards"
                ? "bg-bg-elevated text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "list"
                ? "bg-bg-elevated text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stocks / ETFs top-level tabs */}
      <div className="flex items-center gap-1 mb-5">
        <button
          onClick={() => setActiveTab("stocks")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === "stocks"
              ? "bg-green-primary text-bg-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          Stocks
        </button>
        <button
          onClick={() => setActiveTab("etfs")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === "etfs"
              ? "bg-green-primary text-bg-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          ETFs
        </button>
      </div>

      {/* Sub-navigation dropdown + search */}
      <div className="mb-6 border-b border-border-primary pb-4 flex items-center gap-3 flex-wrap">
        <div className="relative inline-block">
          {activeTab === "stocks" ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSectorDropdownOpen((o) => !o);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-border-primary hover:border-green-primary/50 transition-colors text-sm font-medium text-text-primary min-w-[220px]"
              >
                <span className="flex-1 text-left">
                  {RADAR_SECTORS[selectedSector].label}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-text-tertiary transition-transform ${
                    sectorDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {sectorDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl bg-bg-secondary border border-border-primary shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {RADAR_SECTOR_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedSector(key);
                        setSectorDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        key === selectedSector
                          ? "bg-green-primary/10 text-green-primary font-medium"
                          : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                      }`}
                    >
                      {RADAR_SECTORS[key].label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEtfDropdownOpen((o) => !o);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-border-primary hover:border-green-primary/50 transition-colors text-sm font-medium text-text-primary min-w-[220px]"
              >
                <span className="flex-1 text-left">
                  {RADAR_ETF_CATEGORIES[selectedEtfCategory].label}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-text-tertiary transition-transform ${
                    etfDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {etfDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl bg-bg-secondary border border-border-primary shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {RADAR_ETF_CATEGORY_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedEtfCategory(key);
                        setEtfDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        key === selectedEtfCategory
                          ? "bg-green-primary/10 text-green-primary font-medium"
                          : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                      }`}
                    >
                      {RADAR_ETF_CATEGORIES[key].label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticker or name…"
            className="pl-9 pr-8 py-2 rounded-lg bg-bg-secondary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-green-primary/50 transition-colors w-64"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <RadarGrid
        tickers={tickerItems}
        quotes={quotes}
        expandedTicker={expandedTicker}
        onToggleExpand={handleToggleExpand}
        viewMode={viewMode}
      />
    </div>
  );
}
