"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";

interface Row {
  rank: number;
  ticker: string;
  company_name: string;
  metric: number;
}
type WidgetKey = "most_owned" | "most_owned_pct" | "buys_1q" | "buys_2q" | "sells_1q" | "sells_2q";
interface SummaryResponse {
  quarter: string | null;
  widgets: Record<WidgetKey, Row[]>;
}

type Tone = "neutral" | "buy" | "sell";
type ActivityView = "own" | "buy" | "sell";
interface WidgetMeta {
  title: string;
  verb: string;
  tone: Tone;
  /** Which funds page the badge links to. */
  view: ActivityView;
  /** Render the metric as a percentage (e.g. "2.0%") instead of "{n} {verb}". */
  pct?: boolean;
}

const META: Record<WidgetKey, WidgetMeta> = {
  most_owned:     { title: "Most Owned",          verb: "own",  tone: "neutral", view: "own" },
  most_owned_pct: { title: "Most Owned · % Port", verb: "%",    tone: "neutral", view: "own", pct: true },
  buys_1q:        { title: "Buys · Last Qtr",     verb: "buy",  tone: "buy",     view: "buy" },
  buys_2q:        { title: "Buys · Last 2 Qtrs",  verb: "buy",  tone: "buy",     view: "buy" },
  sells_1q:       { title: "Sells · Last Qtr",    verb: "sell", tone: "sell",    view: "sell" },
  sells_2q:       { title: "Sells · Last 2 Qtrs", verb: "sell", tone: "sell",    view: "sell" },
};

const TONE: Record<"neutral" | "buy" | "sell", string> = {
  neutral: "text-text-secondary bg-bg-tertiary",
  buy: "text-emerald-500 bg-emerald-500/10",
  sell: "text-red-400 bg-red-400/10",
};

function WidgetCard({ k, rows }: { k: WidgetKey; rows: Row[] }) {
  const meta = META[k];
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4">
      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-3">{meta.title}</p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.rank} className="flex items-center justify-between gap-2">
            <Link href={`/stock/${r.ticker}`} className="flex items-center gap-2 min-w-0 group/row">
              <span className="text-text-tertiary text-xs w-4 shrink-0 text-right">{r.rank}</span>
              <CompanyLogo ticker={r.ticker} className="w-5 h-5 rounded" textClassName="text-[8px]" />
              <span className="text-text-primary text-xs font-semibold shrink-0 group-hover/row:text-green-primary transition-colors">{r.ticker}</span>
              <span className="text-text-secondary text-xs truncate group-hover/row:underline">{r.company_name}</span>
            </Link>
            {/* Badge links to the funds that own / bought / sold this ticker. */}
            <Link href={`/experts/activity/${r.ticker}?action=${meta.view}`}>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 hover:brightness-125 transition ${TONE[meta.tone]}`}>
                {meta.pct ? `${r.metric.toFixed(1)}%` : `${r.metric} ${meta.verb}`}
              </span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketSummary() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch("/api/superinvestors/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SummaryResponse) => {
        if (d?.widgets && Object.values(d.widgets).some((w) => w.length)) setData(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  // Summary is additive — hide quietly until data is present.
  if (failed || !data) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 text-text-primary font-semibold text-sm"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        Market Summary
        {data.quarter && <span className="text-text-tertiary font-normal">· {data.quarter}</span>}
      </button>

      {open && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard k="most_owned" rows={data.widgets.most_owned} />
            <WidgetCard k="most_owned_pct" rows={data.widgets.most_owned_pct} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WidgetCard k="buys_1q" rows={data.widgets.buys_1q} />
            <WidgetCard k="buys_2q" rows={data.widgets.buys_2q} />
            <WidgetCard k="sells_1q" rows={data.widgets.sells_1q} />
            <WidgetCard k="sells_2q" rows={data.widgets.sells_2q} />
          </div>
        </div>
      )}
    </div>
  );
}
