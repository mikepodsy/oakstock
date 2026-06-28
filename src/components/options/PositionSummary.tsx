"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Share2, Check } from "lucide-react";
import type { OptionLeg, PayoffResult } from "@/types/options";
import { formatCurrency } from "@/utils/formatters";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color =
    tone === "pos" ? "text-green-primary" : tone === "neg" ? "text-red-primary" : "text-text-primary";
  return (
    <div>
      <p className="text-xs text-text-secondary mb-0.5">{label}</p>
      <p className={`text-lg font-financial ${color}`}>{value}</p>
    </div>
  );
}

const fmtMoneyOrInf = (v: number | null, sign = 1) =>
  v === null ? "Unlimited" : formatCurrency(v * sign);

export function PositionSummary({
  result,
  legs,
  onShare,
}: {
  result: PayoffResult;
  legs: OptionLeg[];
  onShare: () => void;
}) {
  const [showLegs, setShowLegs] = useState(false);
  const [copied, setCopied] = useState(false);
  const { maxProfit, maxLoss, breakevens, netDebit, winRate, netGreeks, perLeg } = result;

  const handleShare = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-text-primary">Position Summary</h3>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-primary" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Share"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Max Profit" value={fmtMoneyOrInf(maxProfit)} tone={maxProfit === null || maxProfit > 0 ? "pos" : undefined} />
        <Stat label="Max Loss" value={fmtMoneyOrInf(maxLoss)} tone="neg" />
        <Stat
          label="Breakeven(s)"
          value={breakevens.length ? breakevens.map((b) => `$${b.toFixed(2)}`).join(", ") : "—"}
        />
        <Stat
          label={netDebit >= 0 ? "Net Debit" : "Net Credit"}
          value={formatCurrency(Math.abs(netDebit))}
          tone={netDebit >= 0 ? "neg" : "pos"}
        />
        <Stat label="Win Rate" value={winRate == null ? "—" : `${(winRate * 100).toFixed(0)}%`} />
      </div>

      {/* Net greeks */}
      <div>
        <p className="text-xs text-text-secondary mb-2">Net Greeks</p>
        <div className="grid grid-cols-5 gap-2 text-center">
          <GreekCell label="Δ" value={netGreeks.delta} />
          <GreekCell label="Θ" value={netGreeks.theta} />
          <GreekCell label="Γ" value={netGreeks.gamma} />
          <GreekCell label="V" value={netGreeks.vega} />
          <GreekCell label="ρ" value={netGreeks.rho} />
        </div>
      </div>

      {/* Per-leg greeks (collapsible) */}
      <div>
        <button
          onClick={() => setShowLegs((s) => !s)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {showLegs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Per-leg greeks
        </button>
        {showLegs && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-tertiary">
                  <th className="text-left font-normal py-1">Leg</th>
                  <th className="text-right font-normal">Δ</th>
                  <th className="text-right font-normal">Γ</th>
                  <th className="text-right font-normal">Θ</th>
                  <th className="text-right font-normal">V</th>
                  <th className="text-right font-normal">IV</th>
                  <th className="text-right font-normal">Mid</th>
                </tr>
              </thead>
              <tbody className="font-financial text-text-primary">
                {perLeg.map((g, i) => {
                  const leg = legs[i];
                  const iv = leg ? leg.ivOverride ?? leg.iv : null;
                  const label = leg
                    ? `${leg.action === "buy" ? "+" : "−"}${leg.qty} ${leg.type === "stock" ? "Stock" : `${leg.strike ?? "?"}${leg.type === "call" ? "C" : "P"}`}`
                    : "—";
                  return (
                    <tr key={g.legId} className="border-t border-border-primary/50">
                      <td className="text-left py-1 text-text-secondary">{label}</td>
                      <td className="text-right">{g.delta.toFixed(1)}</td>
                      <td className="text-right">{g.gamma.toFixed(2)}</td>
                      <td className="text-right">{g.theta.toFixed(1)}</td>
                      <td className="text-right">{g.vega.toFixed(1)}</td>
                      <td className="text-right">{iv != null ? `${(iv * 100).toFixed(0)}%` : "—"}</td>
                      <td className="text-right">{leg?.mid != null ? `$${leg.mid.toFixed(2)}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GreekCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-tertiary py-2">
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p
        className="text-sm font-financial"
        style={{ color: value >= 0 ? "var(--text-primary)" : "var(--red-primary)" }}
      >
        {value.toFixed(2)}
      </p>
    </div>
  );
}
