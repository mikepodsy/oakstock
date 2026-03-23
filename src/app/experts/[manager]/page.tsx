"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Star,
  Minus,
  ChevronDown,
  ExternalLink,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";

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
}

interface Manager {
  id: string;
  name: string;
  fund: string;
  description: string;
  aum_note: string;
  strategy: string;
  updated_at: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function formatShares(n: number): string {
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function pctChange(current: number, prev: number | null): string | null {
  if (prev === null || prev === 0) return null;
  const delta = ((current - prev) / prev) * 100;
  return (delta > 0 ? "+" : "") + delta.toFixed(1) + "%";
}

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600", "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600", "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600", "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600", "from-fuchsia-500 to-violet-600",
  "from-red-500 to-rose-600", "from-yellow-500 to-orange-600",
];
function avatarColor(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Change badge ──────────────────────────────────────────────────────────────
function ChangeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
    new:       { label: "New",       className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", Icon: Star },
    increased: { label: "Added",     className: "bg-blue-500/10 text-blue-400 border-blue-500/20",         Icon: TrendingUp },
    decreased: { label: "Reduced",   className: "bg-orange-500/10 text-orange-400 border-orange-500/20",   Icon: TrendingDown },
    unchanged: { label: "Held",      className: "bg-bg-tertiary text-text-tertiary border-border-primary", Icon: Minus },
    sold:      { label: "Sold",      className: "bg-red-500/10 text-red-400 border-red-500/20",            Icon: TrendingDown },
  };
  const cfg = map[type] ?? map.unchanged;
  const { label, className, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
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
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(manager.id)} flex items-center justify-center text-white font-bold text-xl shrink-0`}
            >
              {getInitials(manager.name)}
            </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Portfolio Value</p>
                <p className="text-text-primary font-bold text-lg">{formatUSD(stats.total_value_usd)}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Holdings</p>
                <p className="text-text-primary font-bold text-lg">{stats.holdings_count}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">New Positions</p>
                <p className="text-emerald-400 font-bold text-lg">{stats.new_positions}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Added To</p>
                <p className="text-blue-400 font-bold text-lg">{stats.increased_positions}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Reduced</p>
                <p className="text-orange-400 font-bold text-lg">{stats.decreased_positions}</p>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl px-4 py-3">
                <p className="text-text-tertiary text-xs mb-1">Unchanged</p>
                <p className="text-text-secondary font-bold text-lg">{stats.unchanged_positions}</p>
              </div>
            </div>
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
            {/* Table header */}
            <div className="grid grid-cols-[2rem_2.5rem_1fr_5rem_6rem_5rem_6rem] gap-3 px-4 py-3 border-b border-border-primary">
              <span className="text-text-tertiary text-xs">#</span>
              <span className="text-text-tertiary text-xs" />
              <span className="text-text-tertiary text-xs">Company</span>
              <span className="text-text-tertiary text-xs text-right">% Port.</span>
              <span className="text-text-tertiary text-xs text-right">Value</span>
              <span className="text-text-tertiary text-xs text-right">Shares</span>
              <span className="text-text-tertiary text-xs text-center">Change</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border-primary">
              {sorted.map((holding, i) => {
                const sharesDelta = pctChange(holding.shares, holding.shares_prev);
                const ticker = holding.ticker ?? holding.company_name.slice(0, 5).toUpperCase();

                return (
                  <div
                    key={holding.id}
                    className="grid grid-cols-[2rem_2.5rem_1fr_5rem_6rem_5rem_6rem] gap-3 px-4 py-3 hover:bg-bg-tertiary transition-colors items-center"
                  >
                    {/* Rank */}
                    <span className="text-text-tertiary text-xs text-right">{i + 1}</span>

                    {/* Logo */}
                    <div className="w-9 h-9">
                      {holding.ticker ? (
                        <CompanyLogo ticker={holding.ticker} />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-tertiary text-xs font-bold">
                          {ticker.slice(0, 2)}
                        </div>
                      )}
                    </div>

                    {/* Company */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {holding.ticker ? (
                          <Link
                            href={`/stock/${holding.ticker}`}
                            className="text-text-primary text-sm font-medium hover:text-green-primary transition-colors flex items-center gap-1"
                          >
                            {holding.ticker}
                            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                          </Link>
                        ) : (
                          <span className="text-text-primary text-sm font-medium">
                            {holding.company_name}
                          </span>
                        )}
                        {holding.option_type && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {holding.option_type}
                          </span>
                        )}
                      </div>
                      <p className="text-text-tertiary text-xs truncate">{holding.company_name}</p>
                    </div>

                    {/* % Portfolio */}
                    <div className="text-right">
                      <span className="text-text-primary text-sm font-medium">
                        {holding.pct_portfolio?.toFixed(2)}%
                      </span>
                      <div className="h-1 mt-1 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-primary/60"
                          style={{ width: `${Math.min(holding.pct_portfolio * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Value */}
                    <span className="text-text-secondary text-sm text-right">
                      {formatUSD(holding.value_usd)}
                    </span>

                    {/* Shares */}
                    <div className="text-right">
                      <span className="text-text-secondary text-sm">
                        {formatShares(holding.shares)}
                      </span>
                      {sharesDelta && (
                        <p className={`text-xs ${parseFloat(sharesDelta) > 0 ? "text-emerald-400" : "text-orange-400"}`}>
                          {sharesDelta}
                        </p>
                      )}
                    </div>

                    {/* Change badge */}
                    <div className="flex justify-center">
                      <ChangeBadge type={holding.change_type} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
              <span className="text-text-tertiary text-xs">
                Showing {sorted.length} of {equityHoldings.length} positions
              </span>
              <span className="text-text-tertiary text-xs">
                Source: SEC EDGAR · {stats?.quarter}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
