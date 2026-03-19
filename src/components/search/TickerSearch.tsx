"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { searchTickers } from "@/services/yahooFinance";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export function TickerSearch({
  onSelect,
}: {
  onSelect: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const performSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await searchTickers(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a ticker or company..."
          className="pl-9 bg-bg-tertiary border-border-primary text-text-primary"
          autoFocus
        />
      </div>

      {(results.length > 0 || isSearching) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-primary bg-bg-elevated shadow-lg max-h-64 overflow-y-auto">
          {isSearching && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-tertiary">
              Searching...
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.ticker}-${r.exchange}`}
                type="button"
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-tertiary transition-colors"
              >
                <div>
                  <span className="font-financial text-sm text-text-primary font-medium">
                    {r.ticker}
                  </span>
                  <span className="text-xs text-text-secondary ml-2">
                    {r.name}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">{r.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
