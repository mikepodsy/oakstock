"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuotes } from "@/hooks/useQuotes";
import { RadarGrid } from "@/components/radar/RadarGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { RADAR_SECTORS, RADAR_SECTOR_KEYS } from "@/utils/constants";

export default function RadarPage() {
  const [selectedSector, setSelectedSector] = useState(RADAR_SECTOR_KEYS[0]);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const sector = RADAR_SECTORS[selectedSector];
  const tickers = useMemo(() => sector.tickers, [sector]);
  const { quotes, loading } = useQuotes(tickers);

  // Collapse expanded card when switching sectors
  useEffect(() => {
    setExpandedTicker(null);
  }, [selectedSector]);

  // Build ticker+name pairs (name comes from quote data or falls back to ticker)
  const tickerItems = useMemo(
    () =>
      tickers.map((t) => ({
        ticker: t,
        name: quotes[t]?.name ?? t,
      })),
    [tickers, quotes]
  );

  function handleToggleExpand(ticker: string) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Radar</h1>
        <p className="text-sm text-text-secondary mt-1">
          Discover stocks by sector
        </p>
      </div>

      {/* Sector Filter Banner */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-border-primary">
        {RADAR_SECTOR_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setSelectedSector(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              key === selectedSector
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {RADAR_SECTORS[key].label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && Object.keys(quotes).length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <RadarGrid
          tickers={tickerItems}
          quotes={quotes}
          expandedTicker={expandedTicker}
          onToggleExpand={handleToggleExpand}
        />
      )}
    </div>
  );
}
