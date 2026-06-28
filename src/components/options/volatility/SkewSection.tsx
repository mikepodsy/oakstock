"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { fetchOptionChain } from "@/services/options";
import { computeSkew } from "@/lib/options/volStats";
import type { SkewData, TermStructurePoint } from "@/types/volatility";

const selectCls =
  "bg-bg-tertiary border border-border-primary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-oak-300 cursor-pointer";

function SkewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-tertiary px-3 py-2">
      <p className="text-[11px] text-text-tertiary">{label}</p>
      <p className="text-sm font-financial text-text-primary">{value}</p>
    </div>
  );
}

const fmtSkew = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

function SkewTooltip({
  active,
  payload,
  xMode,
}: {
  active?: boolean;
  payload?: Array<{ payload: { strike: number; delta: number | null; iv: number | null } }>;
  xMode: "strike" | "delta";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary">
        {xMode === "strike" ? `$${p.strike}` : `Δ ${p.delta?.toFixed(2) ?? "—"}`}
      </p>
      <p className="font-financial text-text-primary">
        IV {p.iv == null ? "—" : `${(p.iv * 100).toFixed(1)}%`}
      </p>
    </div>
  );
}

export function SkewSection({
  ticker,
  term,
  initialSkew,
  spot,
}: {
  ticker: string;
  term: TermStructurePoint[];
  initialSkew: SkewData | null;
  spot: number | null;
}) {
  const expiries = term.map((t) => t.expiry);
  const [expiry, setExpiry] = useState<string>(initialSkew?.expiry ?? expiries[0] ?? "");
  const [skew, setSkew] = useState<SkewData | null>(initialSkew);
  const [xMode, setXMode] = useState<"strike" | "delta">("strike");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (exp: string) => {
      if (initialSkew && exp === initialSkew.expiry) {
        setSkew(initialSkew);
        return;
      }
      setLoading(true);
      try {
        const chain = await fetchOptionChain(ticker, exp);
        setSkew(computeSkew(chain.strikes, chain.spot, exp));
      } catch {
        setSkew(null);
      } finally {
        setLoading(false);
      }
    },
    [ticker, initialSkew],
  );

  useEffect(() => {
    if (expiry) load(expiry);
  }, [expiry, load]);

  const points = (skew?.points ?? []).filter((p) => p.iv != null);
  const xKey = xMode === "strike" ? "strike" : "delta";

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-display text-base text-text-primary">Skew Structure</h3>
        <div className="flex items-center gap-2">
          <select className={selectCls} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {term.map((t) => (
              <option key={t.expiry} value={t.expiry}>
                {t.expiry} · {t.dte}d
              </option>
            ))}
          </select>
          <div className="flex rounded-md border border-border-primary overflow-hidden text-xs">
            {(["strike", "delta"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setXMode(m)}
                className={`px-2.5 py-1.5 capitalize cursor-pointer ${
                  xMode === m ? "bg-bg-elevated text-text-primary" : "text-text-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-text-secondary mb-3">Implied vol by {xMode} for the selected expiry.</p>

      {loading ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-text-secondary">Loading…</div>
      ) : points.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-text-secondary">
          No skew data for this expiry.
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis
                dataKey={xKey}
                type="number"
                domain={["dataMin", "dataMax"]}
                reversed={xMode === "delta"}
                tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
                tickFormatter={(v: number) => (xMode === "strike" ? `$${v}` : v.toFixed(2))}
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
              <Tooltip content={<SkewTooltip xMode={xMode} />} />
              {xMode === "strike" && spot != null && (
                <ReferenceLine
                  x={spot}
                  stroke="var(--text-secondary)"
                  strokeDasharray="2 3"
                  label={{ value: "Spot", position: "top", fill: "var(--text-secondary)", fontSize: 11 }}
                />
              )}
              <Line dataKey="iv" stroke="var(--oak-300)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {skew && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <SkewStat label="Put Skew (25d)" value={fmtSkew(skew.putSkew)} />
          <SkewStat label="Call Skew (25d)" value={fmtSkew(skew.callSkew)} />
          <SkewStat label="Risk Reversal" value={fmtSkew(skew.riskReversal)} />
        </div>
      )}
    </section>
  );
}
