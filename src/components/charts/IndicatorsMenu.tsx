"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, X, Plus } from "lucide-react";
import { useIndicatorStore } from "@/stores/indicatorStore";
import {
  PARAM_BOUNDS,
  maColor,
  INDICATOR_COLORS,
  type MultiLineId,
} from "@/utils/indicatorConfig";

interface IndicatorsMenuProps {
  // Session shading and the relevance of intraday-only features depend on this.
  isIntraday: boolean;
}

function CheckBox({
  checked,
  onChange,
  color,
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? "border-transparent" : "border-border-primary"
      }`}
      style={
        checked
          ? { backgroundColor: color ?? "var(--green-primary)" }
          : undefined
      }
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  bounds,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  bounds: { min: number; max: number; step: number };
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-text-secondary">
      {label}
      <input
        type="number"
        value={value}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-14 rounded border border-border-primary bg-transparent px-1 py-0.5 text-xs text-text-primary outline-none"
      />
    </label>
  );
}

// Adds a new length to a multi-line indicator (SMA/EMA).
function PeriodAdder({ onAdd }: { onAdd: (v: number) => void }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n > 0) {
      onAdd(n);
      setVal("");
    }
  };
  return (
    <span className="flex items-center gap-0.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        inputMode="numeric"
        placeholder="#"
        className="w-9 rounded border border-border-primary bg-transparent px-1 py-0.5 text-xs text-text-primary outline-none"
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Add length"
        className="text-text-secondary hover:text-text-primary"
      >
        <Plus className="h-3 w-3" />
      </button>
    </span>
  );
}

// Editable list of length chips for SMA / EMA.
function PeriodChips({ id }: { id: MultiLineId }) {
  const periods = useIndicatorStore((s) => s[id].periods);
  const addPeriod = useIndicatorStore((s) => s.addPeriod);
  const removePeriod = useIndicatorStore((s) => s.removePeriod);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 pl-6">
      {periods.map((p, idx) => (
        <span
          key={p}
          className="flex items-center gap-1 rounded-full border border-border-primary px-2 py-0.5 text-xs font-medium"
          style={{ color: maColor(idx) }}
        >
          {p}
          <button
            type="button"
            onClick={() => removePeriod(id, p)}
            aria-label={`Remove ${p}`}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <PeriodAdder onAdd={(v) => addPeriod(id, v)} />
    </div>
  );
}

export function IndicatorsMenu({ isIntraday }: IndicatorsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const s = useIndicatorStore();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount = [
    s.sma.enabled,
    s.ema.enabled,
    s.bollinger.enabled,
    s.donchian.enabled,
    s.rsi.enabled,
    s.volume.enabled,
    s.sessions.enabled && isIntraday,
  ].filter(Boolean).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        Indicators
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-primary px-1 text-[10px] text-white">
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-border-primary bg-bg-elevated p-2 shadow-lg">
          {/* SMA */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox checked={s.sma.enabled} onChange={() => s.toggle("sma")} />
              <span className="text-sm text-text-primary">SMA</span>
            </div>
            {s.sma.enabled && <PeriodChips id="sma" />}
          </div>

          {/* EMA */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox checked={s.ema.enabled} onChange={() => s.toggle("ema")} />
              <span className="text-sm text-text-primary">EMA</span>
              <span className="text-[10px] text-text-tertiary">(dashed)</span>
            </div>
            {s.ema.enabled && <PeriodChips id="ema" />}
          </div>

          <div className="my-1 border-t border-border-primary" />

          {/* Bollinger */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox
                checked={s.bollinger.enabled}
                onChange={() => s.toggle("bollinger")}
                color={INDICATOR_COLORS.bollinger}
              />
              <span className="text-sm text-text-primary">Bollinger Bands</span>
            </div>
            {s.bollinger.enabled && (
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                <NumberField
                  label="Length"
                  value={s.bollinger.period}
                  bounds={PARAM_BOUNDS.period}
                  onChange={(v) => s.setParam("bollinger", "period", v)}
                />
                <NumberField
                  label="StdDev"
                  value={s.bollinger.mult}
                  bounds={PARAM_BOUNDS.mult}
                  onChange={(v) => s.setParam("bollinger", "mult", v)}
                />
              </div>
            )}
          </div>

          {/* Donchian */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox
                checked={s.donchian.enabled}
                onChange={() => s.toggle("donchian")}
                color={INDICATOR_COLORS.donchian}
              />
              <span className="text-sm text-text-primary">Donchian Channels</span>
            </div>
            {s.donchian.enabled && (
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                <NumberField
                  label="Length"
                  value={s.donchian.period}
                  bounds={PARAM_BOUNDS.period}
                  onChange={(v) => s.setParam("donchian", "period", v)}
                />
              </div>
            )}
          </div>

          {/* RSI */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox
                checked={s.rsi.enabled}
                onChange={() => s.toggle("rsi")}
                color={INDICATOR_COLORS.rsi}
              />
              <span className="text-sm text-text-primary">RSI</span>
              <span className="text-[10px] text-text-tertiary">(sub-pane)</span>
            </div>
            {s.rsi.enabled && (
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                <NumberField
                  label="Length"
                  value={s.rsi.period}
                  bounds={PARAM_BOUNDS.period}
                  onChange={(v) => s.setParam("rsi", "period", v)}
                />
              </div>
            )}
          </div>

          <div className="my-1 border-t border-border-primary" />

          {/* Volume */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox
                checked={s.volume.enabled}
                onChange={() => s.toggle("volume")}
              />
              <span className="text-sm text-text-primary">Volume</span>
            </div>
          </div>

          {/* Sessions */}
          <div className="py-1">
            <div className="flex items-center gap-2">
              <CheckBox
                checked={s.sessions.enabled && isIntraday}
                onChange={() => {
                  if (isIntraday) s.toggle("sessions");
                }}
              />
              <span
                className={`text-sm ${
                  isIntraday ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                Trading sessions
              </span>
            </div>
            {!isIntraday && (
              <p className="pl-6 text-xs text-text-tertiary">
                Intraday intervals only
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
