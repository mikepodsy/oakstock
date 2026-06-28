"use client";

import { Plus, X } from "lucide-react";
import type { OptionChainData, OptionLeg } from "@/types/options";
import type { OptionsExpiry } from "@/types";
import { dteDays, effectiveIv } from "@/lib/options/position";

const selectCls =
  "bg-bg-tertiary border border-border-primary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-oak-300 cursor-pointer";

export function LegBuilder({
  legs,
  chains,
  expiries,
  spot,
  onUpdate,
  onRemove,
  onAdd,
  onEnsureExpiry,
}: {
  legs: OptionLeg[];
  chains: Record<string, OptionChainData>;
  expiries: OptionsExpiry[];
  spot: number | null;
  onUpdate: (id: string, patch: Partial<OptionLeg>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onEnsureExpiry: (expiry: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base text-text-primary">Legs</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-green-primary hover:underline cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Add leg
        </button>
      </div>

      {legs.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">
          Pick a strategy above, or add legs manually.
        </p>
      ) : (
        <div className="space-y-2">
          {legs.map((leg) => (
            <LegRow
              key={leg.id}
              leg={leg}
              chains={chains}
              expiries={expiries}
              spot={spot}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onEnsureExpiry={onEnsureExpiry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LegRow({
  leg,
  chains,
  expiries,
  spot,
  onUpdate,
  onRemove,
  onEnsureExpiry,
}: {
  leg: OptionLeg;
  chains: Record<string, OptionChainData>;
  expiries: OptionsExpiry[];
  spot: number | null;
  onUpdate: (id: string, patch: Partial<OptionLeg>) => void;
  onRemove: (id: string) => void;
  onEnsureExpiry: (expiry: string) => void;
}) {
  const isStock = leg.type === "stock";
  const chain = leg.expiry ? chains[leg.expiry] : undefined;
  const strikes = chain?.strikes.map((s) => s.strike) ?? [];
  const dte = dteDays(leg.expiry);
  const iv = effectiveIv(leg);
  const longShortCls = leg.action === "buy" ? "text-green-primary" : "text-red-primary";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-primary/40 p-2">
      {/* Buy / Sell */}
      <select
        className={`${selectCls} ${longShortCls} font-medium`}
        value={leg.action}
        onChange={(e) => onUpdate(leg.id, { action: e.target.value as OptionLeg["action"] })}
      >
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>

      {/* Call / Put / Stock */}
      <select
        className={selectCls}
        value={leg.type}
        onChange={(e) => onUpdate(leg.id, { type: e.target.value as OptionLeg["type"] })}
      >
        <option value="call">Call</option>
        <option value="put">Put</option>
        <option value="stock">Stock</option>
      </select>

      {/* Qty */}
      <input
        type="number"
        min={1}
        className={`${selectCls} w-16`}
        value={leg.qty}
        onChange={(e) => onUpdate(leg.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
        aria-label="Quantity"
      />

      {isStock ? (
        <span className="text-xs text-text-secondary px-2">
          {spot != null ? `@ $${spot.toFixed(2)} × 100 sh` : "shares"}
        </span>
      ) : (
        <>
          {/* Expiry */}
          <select
            className={selectCls}
            value={leg.expiry ?? ""}
            onChange={(e) => {
              const expiry = e.target.value;
              onEnsureExpiry(expiry);
              onUpdate(leg.id, { expiry, strike: null, mid: null, iv: null, greeks: null });
            }}
          >
            <option value="" disabled>
              Expiry
            </option>
            {expiries.map((ex) => (
              <option key={ex.date} value={ex.date}>
                {ex.label}
              </option>
            ))}
          </select>

          {/* Strike */}
          <select
            className={selectCls}
            value={leg.strike ?? ""}
            disabled={!leg.expiry || strikes.length === 0}
            onChange={(e) => onUpdate(leg.id, { strike: Number(e.target.value) })}
          >
            <option value="" disabled>
              {leg.expiry && strikes.length === 0 ? "…" : "Strike"}
            </option>
            {strikes.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {/* DTE */}
          {dte != null && (
            <span className="text-xs text-text-tertiary w-12 text-center">{dte}d</span>
          )}
        </>
      )}

      {/* Mid / premium */}
      <div className="flex items-center gap-1 text-sm text-text-primary font-financial w-20">
        <span className="text-text-tertiary text-xs">$</span>
        <input
          type="number"
          step="0.01"
          className={`${selectCls} w-16 font-financial`}
          value={leg.mid ?? ""}
          placeholder="–"
          onChange={(e) =>
            onUpdate(leg.id, { mid: e.target.value === "" ? null : Number(e.target.value) })
          }
          aria-label="Mid price"
        />
      </div>

      {/* IV override */}
      {!isStock && (
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={leg.ivOverride != null}
            onChange={(e) =>
              onUpdate(leg.id, {
                ivOverride: e.target.checked ? (leg.iv ?? 0.3) : null,
              })
            }
          />
          IV
          {leg.ivOverride != null ? (
            <input
              type="number"
              step="0.01"
              className={`${selectCls} w-16`}
              value={(leg.ivOverride * 100).toFixed(1)}
              onChange={(e) => onUpdate(leg.id, { ivOverride: Number(e.target.value) / 100 })}
              aria-label="IV override percent"
            />
          ) : (
            <span className="text-text-tertiary w-10">
              {iv != null ? `${(iv * 100).toFixed(0)}%` : "–"}
            </span>
          )}
        </label>
      )}

      <button
        onClick={() => onRemove(leg.id)}
        className="ml-auto text-text-tertiary hover:text-red-primary transition-colors cursor-pointer"
        aria-label="Remove leg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
