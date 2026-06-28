"use client";

import type { CotCategory } from "@/types";

type Signal = "bullish" | "bearish" | "neutral";

function signalOf(index: number): Signal {
  if (index >= 80) return "bullish";
  if (index <= 20) return "bearish";
  return "neutral";
}

const SIGNAL_LABEL: Record<Signal, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

const SIGNAL_COLOR: Record<Signal, string> = {
  bullish: "var(--green-primary)",
  bearish: "var(--red-primary)",
  neutral: "var(--text-tertiary)",
};

function GaugeRow({ category }: { category: CotCategory }) {
  const { name, index } = category;

  if (index === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-44 shrink-0 text-xs text-text-secondary truncate" title={name}>
          {name}
        </div>
        <div className="flex-1 h-2 rounded-full bg-bg-tertiary" />
        <div className="w-24 shrink-0 text-right text-xs text-text-tertiary">— n/a</div>
      </div>
    );
  }

  const signal = signalOf(index);
  const color = SIGNAL_COLOR[signal];

  return (
    <div className="flex items-center gap-3">
      <div className="w-44 shrink-0 text-xs text-text-secondary truncate" title={name}>
        {name}
      </div>

      {/* Gauge track with bearish (0–20) and bullish (80–100) zones + marker */}
      <div className="relative flex-1 h-2 rounded-full bg-bg-tertiary">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{ width: "20%", backgroundColor: "var(--red-primary)", opacity: 0.18 }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{ width: "20%", backgroundColor: "var(--green-primary)", opacity: 0.18 }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${index}%`, backgroundColor: color }}
        />
      </div>

      <div className="w-24 shrink-0 text-right">
        <span className="font-mono text-xs text-text-primary">{Math.round(index)}</span>
        <span className="ml-1.5 text-xs font-medium" style={{ color }}>
          {SIGNAL_LABEL[signal]}
        </span>
      </div>
    </div>
  );
}

interface CotIndexGaugeProps {
  categories: CotCategory[];
  title: string;
}

export function CotIndexGauge({ categories, title }: CotIndexGaugeProps) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Current net position within its 3-year range. ≥ 80 bullish, ≤ 20 bearish.
      </p>
      <div className="space-y-3">
        {categories.map((c) => (
          <GaugeRow key={c.name} category={c} />
        ))}
      </div>
    </div>
  );
}
