"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { useRadarSource } from "@/hooks/useRadarSource";
import { useRadarReturns } from "@/hooks/useRadarReturns";
import { RadarGrid, type RadarViewMode } from "@/components/radar/RadarGrid";
import { RadarDropdown } from "@/components/radar/RadarDropdown";
import {
  RADAR_SECTORS,
  RADAR_SECTOR_KEYS,
  RADAR_ETF_CATEGORIES,
  RADAR_ETF_CATEGORY_KEYS,
  RADAR_RANKINGS,
  RADAR_TIMEFRAMES,
  RADAR_RANKING_LIMIT,
  type RadarRanking,
} from "@/utils/constants";

type ActiveTab = "stocks" | "etfs";

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("stocks");
  const [selectedSector, setSelectedSector] = useState(RADAR_SECTOR_KEYS[0]);
  const [selectedEtfCategory, setSelectedEtfCategory] = useState(
    RADAR_ETF_CATEGORY_KEYS[0]
  );
  const [ranking, setRanking] = useState<RadarRanking>("gainers");
  const [timeframe, setTimeframe] = useState(RADAR_TIMEFRAMES[0].key);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<RadarViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");

  // Resolve the stock universe from sector + ranking (may hit screener/trending)
  const {
    tickers: stockTickers,
    loading: sourceLoading,
    error: sourceError,
  } = useRadarSource(selectedSector, ranking);

  const etfTickers = useMemo(
    () => RADAR_ETF_CATEGORIES[selectedEtfCategory].tickers,
    [selectedEtfCategory]
  );

  const activeTickers = activeTab === "stocks" ? stockTickers : etfTickers;
  const { quotes, loading: quotesLoading } = useQuotes(
    activeTickers as unknown as string[]
  );
  // Period % return per ticker for non-"Today" timeframes (empty for "1d").
  const { returns: periodReturns, loading: returnsLoading } = useRadarReturns(
    activeTickers as unknown as string[],
    timeframe
  );
  const isDayTimeframe = timeframe === "1d";
  const loading = sourceLoading || quotesLoading;

  const isTrending = activeTab === "stocks" && ranking === "trending";
  const isRanked =
    activeTab === "stocks" && (ranking === "gainers" || ranking === "losers");

  // Reset expanded card + search whenever the displayed set changes
  function resetView() {
    setExpandedTicker(null);
    setSearchQuery("");
  }

  const tickerItems = useMemo(() => {
    let items = activeTickers.map((t) => ({
      ticker: t,
      name: quotes[t]?.name ?? t,
      change: isDayTimeframe ? quotes[t]?.dayChangePercent : periodReturns[t],
    }));

    // Sort + cap for gainers/losers (trending keeps Yahoo's order)
    if (isRanked) {
      const withVal = items.filter((i) => typeof i.change === "number");
      const withoutVal = items.filter((i) => typeof i.change !== "number");
      withVal.sort((a, b) =>
        ranking === "losers"
          ? (a.change as number) - (b.change as number)
          : (b.change as number) - (a.change as number)
      );
      items = [...withVal, ...withoutVal].slice(0, RADAR_RANKING_LIMIT);
    }

    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [
    activeTickers,
    quotes,
    searchQuery,
    isRanked,
    ranking,
    isDayTimeframe,
    periodReturns,
  ]);

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
            Discover stocks and ETFs by sector, theme, and market movement
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
          onClick={() => {
            setActiveTab("stocks");
            resetView();
          }}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === "stocks"
              ? "bg-green-primary text-bg-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          Stocks
        </button>
        <button
          onClick={() => {
            setActiveTab("etfs");
            resetView();
          }}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeTab === "etfs"
              ? "bg-green-primary text-bg-primary"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          ETFs
        </button>
      </div>

      {/* Sub-navigation: dropdowns + search */}
      <div className="mb-6 border-b border-border-primary pb-4 flex items-center gap-3 flex-wrap">
        {activeTab === "stocks" ? (
          <>
            <RadarDropdown
              value={selectedSector}
              options={RADAR_SECTOR_KEYS.map((k) => ({
                key: k,
                label: RADAR_SECTORS[k].label,
              }))}
              onChange={(k) => {
                setSelectedSector(k);
                resetView();
              }}
              disabled={isTrending}
              title={isTrending ? "Trending is market-wide" : undefined}
              minWidthClass="min-w-[220px]"
            />
            <RadarDropdown
              value={ranking}
              options={RADAR_RANKINGS}
              onChange={(k) => {
                setRanking(k as RadarRanking);
                resetView();
              }}
              minWidthClass="min-w-[150px]"
            />
            <RadarDropdown
              value={timeframe}
              options={RADAR_TIMEFRAMES}
              onChange={(k) => {
                setTimeframe(k);
                resetView();
              }}
              minWidthClass="min-w-[120px]"
            />
            {isTrending && (
              <span className="text-xs text-text-tertiary">
                Trending is market-wide
              </span>
            )}
          </>
        ) : (
          <RadarDropdown
            value={selectedEtfCategory}
            options={RADAR_ETF_CATEGORY_KEYS.map((k) => ({
              key: k,
              label: RADAR_ETF_CATEGORIES[k].label,
            }))}
            onChange={(k) => {
              setSelectedEtfCategory(k);
              resetView();
            }}
            minWidthClass="min-w-[220px]"
          />
        )}

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

      {/* Error */}
      {sourceError && (
        <p className="text-sm text-text-secondary mb-4">
          Couldn&apos;t load that list. Showing what&apos;s available.
        </p>
      )}

      {/* Loading hint for remote ranked/trending lists */}
      {loading && tickerItems.length === 0 && (
        <p className="text-sm text-text-tertiary mb-4">Loading…</p>
      )}

      {/* Grid */}
      <RadarGrid
        tickers={tickerItems}
        quotes={quotes}
        changeLoading={!isDayTimeframe && returnsLoading}
        expandedTicker={expandedTicker}
        onToggleExpand={handleToggleExpand}
        viewMode={viewMode}
      />
    </div>
  );
}
