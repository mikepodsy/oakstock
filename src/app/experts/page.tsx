"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Star,
  ArrowRight,
  RefreshCw,
  Minus,
  Search,
} from "lucide-react";
import { ManagerLogo } from "@/components/shared/ManagerLogo";

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
  logo_domain: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
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
          {/* Logo */}
          <ManagerLogo
            id={manager.id}
            name={manager.name}
            logoDomain={manager.logo_domain}
            className="w-14 h-14 rounded-2xl"
            textClassName="text-lg"
          />

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
  const [query, setQuery] = useState("");

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

  const q = query.trim().toLowerCase();
  const filteredManagers = q
    ? managers.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.fund.toLowerCase().includes(q)
      )
    : managers;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Experts</h1>
            <p className="text-text-secondary text-sm mt-1">
              13F portfolios of the world&apos;s top value investors · via Dataroma
            </p>
          </div>
          <div className="shrink-0 mt-1 w-full max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search funds…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-green-primary/40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border-primary text-text-tertiary text-xs leading-relaxed">
          Holdings come from quarterly 13F filings (aggregated by Dataroma) required of institutional managers with &gt;$100M AUM.
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
        ) : filteredManagers.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-text-tertiary text-sm">
            No funds match &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredManagers.map((m) => (
              <ManagerCard key={m.id} manager={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
