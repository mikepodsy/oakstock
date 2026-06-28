"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { NewsCard } from "./NewsCard";
import type { MacroNewsItem, StockNewsItem } from "@/types/news";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function ColumnSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function LastUpdated({ at }: { at: Date | null }) {
  if (!at) return null;
  return (
    <span className="text-xs text-text-tertiary">
      Last updated {formatDistanceToNow(at, { addSuffix: true })}
    </span>
  );
}

export function NewsSection() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const watchlists = useWatchlistStore((s) => s.watchlists);

  // Union of portfolio holdings + watchlist tickers.
  const tickers = useMemo(() => {
    const set = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) set.add(h.ticker);
    }
    for (const w of watchlists) {
      for (const item of w.items) set.add(item.ticker);
    }
    return Array.from(set);
  }, [portfolios, watchlists]);

  const [macro, setMacro] = useState<MacroNewsItem[]>([]);
  const [stocks, setStocks] = useState<StockNewsItem[]>([]);
  const [macroUpdated, setMacroUpdated] = useState<Date | null>(null);
  const [stocksUpdated, setStocksUpdated] = useState<Date | null>(null);
  const [macroFailed, setMacroFailed] = useState(false);
  const [stocksFailed, setStocksFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async (symbols: string[]) => {
    const macroPromise = fetch("/api/news/macro")
      .then((r) => {
        if (!r.ok) throw new Error("macro");
        return r.json();
      })
      .then((data: MacroNewsItem[]) => {
        setMacro(data);
        setMacroUpdated(new Date());
        setMacroFailed(false);
      })
      .catch(() => setMacroFailed(true));

    const stocksPromise =
      symbols.length === 0
        ? Promise.resolve().then(() => {
            setStocks([]);
            setStocksUpdated(new Date());
            setStocksFailed(false);
          })
        : fetch(`/api/news/stocks?symbols=${encodeURIComponent(symbols.join(","))}`)
            .then((r) => {
              if (!r.ok) throw new Error("stocks");
              return r.json();
            })
            .then((data: StockNewsItem[]) => {
              setStocks(data);
              setStocksUpdated(new Date());
              setStocksFailed(false);
            })
            .catch(() => setStocksFailed(true));

    await Promise.all([macroPromise, stocksPromise]);
    setLoading(false);
  }, []);

  // Initial fetch, refetch when tickers change, and auto-refresh every 5 min.
  useEffect(() => {
    fetchNews(tickers);
    const id = setInterval(() => fetchNews(tickers), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews, tickers]);

  const bothFailed = macroFailed && stocksFailed;

  if (bothFailed && !loading) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 text-center text-sm text-text-secondary">
        News unavailable. Please try again later.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      {/* Market News (macro) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-text-primary">Market News</h2>
          <LastUpdated at={macroUpdated} />
        </div>
        {loading && macro.length === 0 ? (
          <ColumnSkeletons />
        ) : macroFailed ? (
          <p className="text-sm text-text-tertiary">Market news unavailable.</p>
        ) : (
          <div className="space-y-3">
            {macro.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Portfolio News (stocks) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-text-primary">Portfolio News</h2>
          <LastUpdated at={stocksUpdated} />
        </div>
        {loading && stocks.length === 0 ? (
          <ColumnSkeletons />
        ) : stocksFailed ? (
          <p className="text-sm text-text-tertiary">Portfolio news unavailable.</p>
        ) : tickers.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            Add holdings or watchlist tickers to see related news.
          </p>
        ) : stocks.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No recent news for your tickers.
          </p>
        ) : (
          <div className="space-y-3">
            {stocks.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
