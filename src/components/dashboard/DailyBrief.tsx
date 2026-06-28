"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import {
  newsSourceBadgeClass,
  type BriefArticle,
  type DailyBrief as DailyBriefData,
} from "@/types/news";

function formatBriefDate(ymd: string): string {
  // ymd is YYYY-MM-DD; render in a friendly, locale-aware form.
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function ArticleRow({ article }: { article: BriefArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border-primary bg-bg-secondary p-4 transition-all duration-150 hover:border-oak-300/40 hover:bg-bg-tertiary"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            newsSourceBadgeClass(article.source)
          )}
        >
          {article.source}
        </span>
        {article.tickers && article.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.tickers.slice(0, 6).map((ticker) => (
              <Badge key={ticker} variant="secondary" className="text-[10px]">
                {ticker}
              </Badge>
            ))}
          </div>
        )}
        <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary transition-colors group-hover:text-green-primary" />
      </div>

      <h3 className="text-sm font-semibold text-text-primary transition-colors group-hover:text-green-primary">
        {article.title}
      </h3>

      {article.why && (
        <p className="mt-1.5 text-xs text-text-secondary">{article.why}</p>
      )}
    </a>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 rounded-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function DailyBrief() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const watchlists = useWatchlistStore((s) => s.watchlists);

  // Union of portfolio holdings + watchlist tickers (same as the news page).
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

  const [brief, setBrief] = useState<DailyBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchBrief = useCallback(async (symbols: string[], refresh = false) => {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams();
      if (symbols.length > 0) params.set("symbols", symbols.join(","));
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/news/brief?${params.toString()}`);
      if (!res.ok) throw new Error("brief");
      const data: DailyBriefData = await res.json();
      setBrief(data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and whenever the ticker set changes (no interval — daily).
  useEffect(() => {
    fetchBrief(tickers);
  }, [fetchBrief, tickers]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-oak-300" />
          <h2 className="font-display text-lg text-text-primary">Today&apos;s Brief</h2>
          {brief && (
            <span className="text-xs text-text-tertiary">
              {formatBriefDate(brief.date)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchBrief(tickers, true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-oak-300/40 hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading && !brief ? (
        <BriefSkeleton />
      ) : failed || !brief ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 text-center text-sm text-text-secondary">
          Daily brief unavailable. Please try again later.
        </div>
      ) : (
        <div className="space-y-3">
          {brief.highImpact && (
            <div className="flex items-start gap-3 rounded-xl border border-red-primary/30 bg-red-primary/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-primary">
                  High impact today
                </p>
                <p className="mt-0.5 text-sm text-text-primary">{brief.highImpact}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              What to expect
            </p>
            <p className="mt-1 text-sm leading-relaxed text-text-primary">
              {brief.outlook}
            </p>
          </div>

          {brief.articles.map((article, i) => (
            <ArticleRow key={`${article.url}-${i}`} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}
