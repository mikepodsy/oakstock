"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Action = "buy" | "sell";

interface FundActivity {
  manager: string;
  managerCode: string;
  activity: string;
  pct_portfolio: number;
  shares: number;
  value_usd: number;
}

interface ActivityResponse {
  ticker: string;
  company_name: string;
  action: Action;
  funds: FundActivity[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ── Row ───────────────────────────────────────────────────────────────────────
function FundRow({ fund, action }: { fund: FundActivity; action: Action }) {
  const tone = action === "buy" ? "text-emerald-500" : "text-red-400";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-primary last:border-b-0">
      <div className="min-w-0">
        <p className="text-text-primary text-sm font-medium truncate">
          {fund.manager}
        </p>
        <p className="text-text-tertiary text-xs">
          {fund.shares.toLocaleString()} shares · {fund.pct_portfolio.toFixed(2)}% of portfolio
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={`text-sm font-medium ${tone}`}>{fund.activity}</span>
        <span className="text-text-secondary text-sm w-20 text-right">
          {formatUSD(fund.value_usd)}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StockActivityPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = use(params);
  const searchParams = useSearchParams();
  const action: Action = searchParams.get("action") === "sell" ? "sell" : "buy";

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    function load() {
      setLoading(true);
      setError(null);
      fetch(`/api/superinvestors/activity/${ticker}?action=${action}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
        .then((d: ActivityResponse) => {
          if (!active) return;
          setData(d);
          setLoading(false);
        })
        .catch((e) => {
          if (!active) return;
          setError(e.message);
          setLoading(false);
        });
    }
    load();
    return () => {
      active = false;
    };
  }, [ticker, action]);

  const verb = action === "buy" ? "buying" : "selling";
  const Icon = action === "buy" ? TrendingUp : TrendingDown;
  const tone = action === "buy" ? "text-emerald-500" : "text-red-400";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="shrink-0 px-6 pt-5 pb-4 max-w-3xl w-full mx-auto">
        {/* Back nav */}
        <Link
          href="/experts"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Superinvestors
        </Link>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-5 w-5 ${tone}`} />
          <h1 className="text-2xl font-bold text-text-primary">
            Funds {verb}{" "}
            <Link href={`/stock/${ticker}`} className="hover:underline">
              {data?.ticker || ticker.toUpperCase()}
            </Link>
          </h1>
        </div>
        <p className="text-text-secondary text-sm">
          {data?.company_name ? `${data.company_name} · ` : ""}
          Superinvestors who {action === "buy" ? "added to or opened" : "trimmed or closed"} this position last quarter · via Dataroma
        </p>
      </div>

      {/* List */}
      <div className="flex-1 px-6 pb-6 max-w-3xl w-full mx-auto">
        {error ? (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">
            Failed to load activity: {error}
          </div>
        ) : loading ? (
          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b border-border-primary last:border-b-0 animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-3.5 w-48 bg-bg-tertiary rounded" />
                  <div className="h-3 w-32 bg-bg-tertiary rounded" />
                </div>
                <div className="h-3.5 w-16 bg-bg-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : !data || data.funds.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-text-tertiary text-sm">
            No funds {verb} {data?.ticker || ticker.toUpperCase()} last quarter.
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            {data.funds.map((fund) => (
              <FundRow key={fund.managerCode} fund={fund} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
