"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Star,
  ArrowRight,
  Users,
  RefreshCw,
  Minus,
  Download,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TopHolding {
  ticker: string | null;
  company_name: string;
  pct_portfolio: number;
  change_type: string;
}

interface ExpertManager {
  id: string;
  name: string;
  fund: string;
  description: string;
  aum_note: string;
  strategy: string;
  latest_quarter: string | null;
  filed_date: string | null;
  total_value_usd: number;
  holdings_count: number;
  new_positions: number;
  top_holdings: TopHolding[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-violet-600",
  "from-red-500 to-rose-600",
  "from-yellow-500 to-orange-600",
];

function avatarColor(id: string): string {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function ChangeIcon({ type }: { type: string }) {
  if (type === "new") return <Star className="h-3 w-3 text-emerald-500" />;
  if (type === "increased") return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (type === "decreased") return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-text-tertiary" />;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-bg-tertiary shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-bg-tertiary rounded w-3/4" />
          <div className="h-3 bg-bg-tertiary rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mb-5">
        <div className="h-3 bg-bg-tertiary rounded" />
        <div className="h-3 bg-bg-tertiary rounded w-4/5" />
      </div>
      <div className="h-px bg-border-primary mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 bg-bg-tertiary rounded w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Manager Card ──────────────────────────────────────────────────────────────
function ManagerCard({ manager }: { manager: ExpertManager }) {
  const hasData = manager.latest_quarter !== null;

  return (
    <Link href={`/experts/${manager.id}`} className="group block">
      <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 h-full transition-all duration-200 hover:border-green-primary hover:shadow-lg hover:shadow-black/10 cursor-pointer">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor(manager.id)} flex items-center justify-center text-white font-bold text-lg shrink-0`}
          >
            {getInitials(manager.name)}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-text-primary font-semibold text-base leading-tight truncate group-hover:text-green-primary transition-colors">
              {manager.name}
            </h2>
            <p className="text-text-secondary text-sm truncate">{manager.fund}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary">
                {manager.strategy}
              </span>
              {manager.aum_note && (
                <span className="text-xs text-text-tertiary">{manager.aum_note}</span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-2">
          {manager.description}
        </p>

        <div className="h-px bg-border-primary mb-4" />

        {hasData ? (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-text-tertiary text-xs mb-0.5">Portfolio</p>
                <p className="text-text-primary text-sm font-semibold">
                  {formatUSD(manager.total_value_usd)}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-0.5">Holdings</p>
                <p className="text-text-primary text-sm font-semibold">
                  {manager.holdings_count}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-0.5">New Buys</p>
                <p className="text-emerald-500 text-sm font-semibold">
                  {manager.new_positions}
                </p>
              </div>
            </div>

            {/* Top holdings */}
            <div className="space-y-1.5">
              <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">
                Top Positions · {manager.latest_quarter}
              </p>
              {manager.top_holdings.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChangeIcon type={h.change_type} />
                    <span className="text-text-primary text-xs font-medium truncate">
                      {h.ticker ?? h.company_name}
                    </span>
                  </div>
                  <span className="text-text-secondary text-xs shrink-0">
                    {h.pct_portfolio?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-primary">
              <span className="text-text-tertiary text-xs">
                Filed {manager.filed_date ?? "—"}
              </span>
              <span className="flex items-center gap-1 text-green-primary text-xs font-medium group-hover:gap-2 transition-all">
                View all <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
            <RefreshCw className="h-6 w-6 mb-2 opacity-40" />
            <p className="text-sm">Data loading soon</p>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExpertsPage() {
  const [managers, setManagers] = useState<ExpertManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  function loadManagers() {
    setLoading(true);
    fetch("/api/experts")
      .then((r) => r.json())
      .then((data) => {
        setManagers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }

  useEffect(() => { loadManagers(); }, []);

  async function handleRefreshAll() {
    setRefreshing(true);
    setRefreshMsg("Fetching 13F data from SEC EDGAR… this may take a minute.");
    try {
      const r = await fetch("/api/experts/refresh", { method: "POST" });
      const data = await r.json();
      const fetched = Object.values(data.results ?? {}).filter(
        (v: unknown) => (v as { status?: string }).status === "fetched"
      ).length;
      setRefreshMsg(`Done! Fetched data for ${fetched} manager(s). Reloading…`);
      setTimeout(() => { loadManagers(); setRefreshMsg(null); }, 1500);
    } catch (e: unknown) {
      setRefreshMsg(`Refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  const totalTracked = managers.length;
  const withData = managers.filter((m) => m.latest_quarter).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Experts</h1>
            <p className="text-text-secondary text-sm mt-1">
              Institutional 13F filings from the world's top investors · SEC EDGAR
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 mt-1">
            <div className="flex items-center gap-1.5 text-text-tertiary text-sm">
              <Users className="h-4 w-4" />
              <span>{totalTracked} tracked</span>
            </div>
            {withData > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-muted text-green-primary border border-green-primary/20">
                {withData} with data
              </span>
            )}
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-primary text-text-secondary hover:text-text-primary hover:border-green-primary/40 text-xs transition-colors disabled:opacity-50"
              title="Fetch latest 13F data from SEC EDGAR"
            >
              {refreshing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {refreshing ? "Fetching…" : "Fetch 13F Data"}
            </button>
          </div>
        </div>

        {/* Refresh status */}
        {refreshMsg && (
          <div className="mt-3 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
            {refreshMsg}
          </div>
        )}

        {/* Info banner */}
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border-primary text-text-tertiary text-xs leading-relaxed">
          13F filings are quarterly SEC disclosures required of institutional managers with &gt;$100M AUM.
          They reveal US long equity positions only — no shorts, bonds, or international holdings.
          Data is filed up to 45 days after quarter end.
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-6 pb-6">
        {error ? (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">
            Failed to load data: {error}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {managers.map((m) => (
              <ManagerCard key={m.id} manager={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
