"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { TermStructurePoint } from "@/types/volatility";

function Flag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-oak-300/15 text-oak-300 text-xs px-2.5 py-1">{label}</span>
  );
}

function TermTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TermStructurePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary">{format(new Date(`${p.expiry}T12:00:00Z`), "MMM d, yyyy")}</p>
      <p className="text-text-tertiary">{p.dte} DTE</p>
      <p className="font-financial text-text-primary">
        ATM IV {p.atmIv == null ? "—" : `${(p.atmIv * 100).toFixed(1)}%`}
      </p>
    </div>
  );
}

export function TermStructureSection({ term }: { term: TermStructurePoint[] }) {
  const { backwardation, elevatedFront } = useMemo(() => {
    if (term.length < 2) return { backwardation: false, elevatedFront: false };
    const front = term[0].atmIv;
    const back = term[term.length - 1].atmIv;
    if (front == null || back == null) return { backwardation: false, elevatedFront: false };
    return { backwardation: front > back, elevatedFront: front - back > 0.05 };
  }, [term]);

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-display text-base text-text-primary">Term Structure</h3>
        <div className="flex items-center gap-2">
          {backwardation && <Flag label="Backwardation" />}
          {elevatedFront && <Flag label="Elevated Front Vol" />}
        </div>
      </div>
      <p className="text-xs text-text-secondary mb-3">ATM implied vol by expiration.</p>

      {term.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-text-secondary">
          No term-structure data available.
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={term} margin={{ top: 8, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey="dte"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(v: number) => `${v}d`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<TermTooltip />} />
              <Line
                dataKey="atmIv"
                stroke="var(--oak-300)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--oak-300)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
