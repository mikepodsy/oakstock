"use client";

import { Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { TickerSearch } from "@/components/search/TickerSearch";
import type { Peer } from "@/lib/comps/peers";

interface PeerBarProps {
  target: string;
  peers: string[];
  suggested: Peer[] | null;
  approximate: boolean;
  loadingSuggestions: boolean;
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
  onReset: () => void;
  onRegenerate: () => void;
}

export function PeerBar({
  target,
  peers,
  suggested,
  approximate,
  loadingSuggestions,
  onAdd,
  onRemove,
  onReset,
  onRegenerate,
}: PeerBarProps) {
  const [adding, setAdding] = useState(false);
  const reasons = new Map((suggested ?? []).map((p) => [p.ticker, p.reason]));

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-display text-base text-text-primary">Peer group</h2>
          <p className="text-xs text-text-secondary">
            {loadingSuggestions
              ? "Finding comparable companies…"
              : approximate
                ? "Approximate peers (Yahoo “similar symbols”). Refine them by hand."
                : "Suggested by Claude as business-model competitors. Hover a chip for the reason."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            disabled={!suggested}
            className="flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
            title="Restore the suggested peer set"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
          <button
            onClick={onRegenerate}
            disabled={loadingSuggestions}
            className="flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
            title="Ask for a fresh peer set"
          >
            <Sparkles className="size-3" /> Re-suggest
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-primary/15 px-3 py-1 text-xs font-medium text-green-primary">
          {target}
        </span>
        {peers.map((p) => (
          <span
            key={p}
            title={reasons.get(p) || undefined}
            className="group flex items-center gap-1 rounded-full border border-border-primary bg-bg-tertiary py-1 pl-3 pr-1.5 text-xs text-text-primary"
          >
            {p}
            <button
              onClick={() => onRemove(p)}
              className="rounded-full p-0.5 text-text-tertiary hover:bg-bg-elevated hover:text-red-primary"
              aria-label={`Remove ${p}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="w-64">
            <TickerSearch
              onSelect={(r) => {
                onAdd(r.ticker);
                setAdding(false);
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Plus className="size-3" /> Add ticker
          </button>
        )}
      </div>
    </div>
  );
}
