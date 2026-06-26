"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { ManagerLogo } from "@/components/shared/ManagerLogo";
import { FundPerformance } from "./FundPerformance";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Holding {
  id: number;
  manager_id: string;
  quarter: string;
  cusip: string | null;
  ticker: string | null;
  company_name: string;
  value_usd: number;
  shares: number;
  share_class: string | null;
  option_type: string | null;
  change_type: string;
  shares_prev: number | null;
  pct_portfolio: number;
  activity: string | null;
}

interface Manager {
  id: string;
  name: string;
  fund: string;
  description: string;
  aum_note: string;
  strategy: string;
  updated_at: string;
  logo_domain: string | null;
  public_ticker: string | null;
}

interface Stats {
  total_value_usd: number;
  holdings_count: number;
  new_positions: number;
  increased_positions: number;
  decreased_positions: number;
  unchanged_positions: number;
  quarter: string;
  filed_date: string | null;
}

interface ExpertData {
  manager: Manager;
  quarters: string[];
  active_quarter: string;
  prev_quarter: string | null;
  holdings: Holding[];
  stats: Stats;
}

interface Quote {
  currentPrice: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Color the raw Dataroma "Recent Activity" text (Add/Buy green, Reduce/Sell red).
function activityColor(activity: string | null): string {
  const a = (activity ?? "").toLowerCase();
  if (a.startsWith("add") || a.startsWith("buy")) return "text-emerald-400";
  if (a.startsWith("reduce") || a.startsWith("sell")) return "text-red-400";
  return "text-text-tertiary";
}

// Yahoo uses a dash for share-class tickers (BRK.B → BRK-B).
function yahooSymbol(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

// ── Sector donut (simple CSS-based) ──────────────────────────────────────────
function TopBar({ holdings }: { holdings: Holding[] }) {
  // Top 8 by value for a visual bar
  const top = holdings
    .filter((h) => !h.option_type)
    .slice(0, 8);
  const total = top.reduce((s, h) => s + h.value_usd, 0);
  const COLORS = [
    "#22c55e","#3b82f6","#8b5cf6","#f97316",
    "#ec4899","#06b6d4","#eab308","#ef4444",
  ];
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {top.map((h, i) => (
        <div
          key={i}
          style={{ width: `${(h.value_usd / total) * 100}%`, backgroundColor: COLORS[i] }}
          title={`${h.ticker ?? h.company_name}: ${((h.value_usd / total) * 100).toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
          <div className="w-6 h-3 bg-bg-tertiary rounded" />
          <div className="w-9 h-9 bg-bg-tertiary rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-bg-tertiary rounded w-32" />
            <div className="h-2.5 bg-bg-tertiary rounded w-20" />
          </div>
          <div className="w-16 h-3 bg-bg-tertiary rounded" />
          <div className="w-20 h-3 bg-bg-tertiary rounded" />
          <div className="w-16 h-3 bg-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExpertDetailPage({
  params,
}: {
  params: Promise<{ manager: string }>;
}) {
  const { manager: managerId } = use(params);
  const [data, setData] = useState<ExpertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [filterChange, setFilterChange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"value" | "pct" | "change">("value");
  const [quarterOpen, setQuarterOpen] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    const url = `/api/experts/${managerId}${selectedQuarter ? `?quarter=${encodeURIComponent(selectedQuarter)}` : ""}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [managerId, selectedQuarter]);

  // Fetch live quotes (current price + 52-week range) for the loaded holdings.
  useEffect(() => {
    const symbols = Array.from(
      new Set(
        (data?.holdings ?? [])
          .map((h) => h.ticker)
          .filter((t): t is string => Boolean(t))
          .map(yahooSymbol)
      )
    );
    if (symbols.length === 0) return;
    let cancelled = false;
    fetch(`/api/quotes?tickers=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => r.json())
      .then((arr) => {
        if (cancelled || !Array.isArray(arr)) return;
        const map: Record<string, Quote> = {};
        for (const q of arr) {
          map[q.ticker] = {
            currentPrice: q.currentPrice,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          };
        }
        setQuotes(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [data]);

  const manager = data?.manager;
  const stats = data?.stats;
  const quarters = data?.quarters ?? [];

  // Filter + sort holdings
  const equityHoldings = (data?.holdings ?? []).filter(
    (h) => showOptions ? true : !h.option_type
  );

  const filtered = equityHoldings.filter(
    (h) => filterChange === "all" || h.change_type === filterChange
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "value") return b.value_usd - a.value_usd;
    if (sortBy === "pct")   return b.pct_portfolio - a.pct_portfolio;
    // sort by change: new > increased > decreased > unchanged
    const order = { new: 0, increased: 1, decreased: 2, unchanged: 3 };
    return (order[a.change_type as keyof typeof order] ?? 4) - (order[b.change_type as keyof typeof order] ?? 4);
  });

  const CHANGE_FILTERS = [
    { key: "all",       label: "All" },
    { key: "new",       label: "New" },
    { key: "increased", label: "Added" },
    { key: "decreased", label: "Reduced" },
    { key: "unchanged", label: "Held" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back nav */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <Link
          href="/experts"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Experts
        </Link>

        {/* Manager header */}
        {manager ? (
          <div className="flex items-start gap-5 mb-5">
            <ManagerLogo
              id={manager.id}
              name={manager.name}
              logoDomain={manager.logo_domain}
              className="w-16 h-16 rounded-2xl"
              textClassName="text-xl"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text-primary">{manager.name}</h1>
              <p className="text-text-secondary">{manager.fund}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary">
                  {manager.strategy}
                </span>
                <span className="text-xs text-text-tertiary">{manager.aum_note}</span>
              </div>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl">
                {manager.description}
              </p>
            </div>

            {/* Quarter selector */}
            {quarters.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setQuarterOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm hover:border-green-primary/40 transition-colors"
                >
                  <span>{stats?.quarter ?? quarters[0]}</span>
                  <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${quarterOpen ? "rotate-180" : ""}`} />
                </button>
                {quarterOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-bg-secondary border border-border-primary rounded-xl shadow-xl min-w-[130px] py-1">
                    {quarters.map((q) => (
                      <button
                        key={q}
                        onClick={() => { setSelectedQuarter(q); setQuarterOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          q === (stats?.quarter ?? quarters[0])
                            ? "text-green-primary bg-green-muted"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-5 mb-5 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-bg-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-bg-tertiary rounded w-48" />
              <div className="h-4 bg-bg-tertiary rounded w-32" />
            </div>
          </div>
        ) : null}

        {/* Stats strip */}
        {stats && (
          <>
            {/* Portfolio bar */}
            <div className="mb-3">
              <TopBar holdings={data?.holdings ?? []} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5 max-w-md">
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Portfolio Value</p>
                <p className="text-text-primary font-bold text-lg">{formatUSD(stats.total_value_usd)}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Holdings</p>
                <p className="text-text-primary font-bold text-lg">{stats.holdings_count}</p>
              </div>
            </div>

            {/* Fund performance + Sharpe */}
            <FundPerformance managerId={managerId} />
          </>
        )}

        {/* Info notice */}
        {!loading && data && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border-primary text-text-tertiary text-xs mb-4">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              13F data reflects US long equity positions as of <strong className="text-text-secondary">{stats?.quarter}</strong>
              {stats?.filed_date && `, filed ${stats.filed_date}`}. Options, shorts, and non-US holdings are excluded.
            </span>
          </div>
        )}

        {/* Filters row */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            {/* Change filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CHANGE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterChange(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    filterChange === f.key
                      ? "bg-green-muted text-green-primary border-green-primary/30"
                      : "bg-bg-tertiary text-text-secondary border-border-primary hover:text-text-primary"
                  }`}
                >
                  {f.label}
                  {f.key !== "all" && (
                    <span className="ml-1 opacity-60">
                      {(data?.holdings ?? []).filter((h) => !h.option_type && h.change_type === f.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Show options toggle */}
              <button
                onClick={() => setShowOptions((o) => !o)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  showOptions
                    ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                    : "bg-bg-tertiary text-text-secondary border-border-primary hover:text-text-primary"
                }`}
              >
                Options {showOptions ? "on" : "off"}
              </button>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "value" | "pct" | "change")}
                className="bg-bg-tertiary border border-border-primary text-text-secondary text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-green-primary/40"
              >
                <option value="value">Sort: Value</option>
                <option value="pct">Sort: % Portfolio</option>
                <option value="change">Sort: Change</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Holdings table */}
      <div className="flex-1 px-6 pb-6">
        {loading ? (
          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            <TableSkeleton />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-400 gap-2">
            <AlertCircle className="h-8 w-8 opacity-60" />
            <p className="text-sm">Failed to load: {error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-tertiary gap-2">
            <BarChart3 className="h-8 w-8 opacity-40" />
            <p className="text-sm">No 13F data available yet. Run the fetch tool to populate.</p>
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr className="border-b border-border-primary text-text-tertiary text-xs">
                    <th className="text-left  font-normal px-4 py-3">Stock</th>
                    <th className="text-right font-normal px-3 py-3 whitespace-nowrap">% of Portfolio</th>
                    <th className="text-left  font-normal px-3 py-3 whitespace-nowrap">Recent Activity</th>
                    <th className="text-right font-normal px-3 py-3">Shares</th>
                    <th className="text-right font-normal px-3 py-3 whitespace-nowrap">Reported Price</th>
                    <th className="text-right font-normal px-3 py-3">Value</th>
                    <th className="text-right font-normal px-3 py-3 whitespace-nowrap">Current Price</th>
                    <th className="text-right font-normal px-3 py-3 whitespace-nowrap">+/- Reported</th>
                    <th className="text-right font-normal px-3 py-3 whitespace-nowrap">52W Low</th>
                    <th className="text-right font-normal px-3 py-3 pr-4 whitespace-nowrap">52W High</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {sorted.map((holding) => {
                    const ticker = holding.ticker ?? holding.company_name.slice(0, 5).toUpperCase();
                    const reported = holding.shares > 0 ? holding.value_usd / holding.shares : null;
                    const quote = holding.ticker ? quotes[yahooSymbol(holding.ticker)] : undefined;
                    const current = quote?.currentPrice;
                    const vsReported =
                      reported && current ? ((current - reported) / reported) * 100 : null;

                    return (
                      <tr key={holding.id} className="hover:bg-bg-tertiary transition-colors">
                        {/* Stock */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {holding.ticker ? (
                              <CompanyLogo
                                ticker={holding.ticker}
                                className="w-8 h-8 rounded-md"
                                textClassName="text-[10px]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-bg-tertiary flex items-center justify-center text-text-tertiary text-[10px] font-bold shrink-0">
                                {ticker.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {holding.ticker ? (
                                  <Link
                                    href={`/stock/${holding.ticker}`}
                                    className="text-text-primary font-medium hover:text-green-primary transition-colors flex items-center gap-1"
                                  >
                                    {holding.ticker}
                                    <ExternalLink className="h-2.5 w-2.5 opacity-40" />
                                  </Link>
                                ) : (
                                  <span className="text-text-primary font-medium">{holding.company_name}</span>
                                )}
                                {holding.option_type && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    {holding.option_type}
                                  </span>
                                )}
                              </div>
                              <p className="text-text-tertiary text-xs truncate max-w-[220px]">{holding.company_name}</p>
                            </div>
                          </div>
                        </td>

                        {/* % of Portfolio */}
                        <td className="px-3 py-3 text-right text-text-primary font-medium tabular-nums">
                          {holding.pct_portfolio?.toFixed(2)}
                        </td>

                        {/* Recent Activity */}
                        <td className={`px-3 py-3 whitespace-nowrap tabular-nums ${activityColor(holding.activity)}`}>
                          {holding.activity || "—"}
                        </td>

                        {/* Shares */}
                        <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                          {holding.shares.toLocaleString()}
                        </td>

                        {/* Reported Price */}
                        <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                          {formatPrice(reported)}
                        </td>

                        {/* Value */}
                        <td className="px-3 py-3 text-right text-text-primary tabular-nums">
                          ${holding.value_usd.toLocaleString()}
                        </td>

                        {/* Current Price */}
                        <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                          {formatPrice(current)}
                        </td>

                        {/* +/- Reported */}
                        <td className={`px-3 py-3 text-right tabular-nums ${
                          vsReported === null ? "text-text-tertiary" : vsReported >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {vsReported === null ? "—" : `${vsReported >= 0 ? "+" : ""}${vsReported.toFixed(2)}%`}
                        </td>

                        {/* 52W Low */}
                        <td className="px-3 py-3 text-right text-text-tertiary tabular-nums">
                          {formatPrice(quote?.fiftyTwoWeekLow)}
                        </td>

                        {/* 52W High */}
                        <td className="px-3 py-3 pr-4 text-right text-text-tertiary tabular-nums">
                          {formatPrice(quote?.fiftyTwoWeekHigh)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
              <span className="text-text-tertiary text-xs">
                Showing {sorted.length} of {equityHoldings.length} positions
              </span>
              <span className="text-text-tertiary text-xs">
                Holdings: Dataroma · Quotes: Yahoo Finance · {stats?.quarter}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
