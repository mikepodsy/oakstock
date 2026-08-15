"use client";

// Per-indicator settings, opened from the gear on a legend row. The picker
// modal only chooses indicators; everything configurable about one lives here,
// next to the line it affects.
//
// The field components (NumberField, PeriodChips, ColorControl wiring) moved
// here from the old IndicatorsMenu dropdown unchanged.

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useIndicators } from "./ChartConfigContext";
import { ColorControl } from "./ColorControl";
import {
  INDICATOR_COLORS,
  PARAM_BOUNDS,
  maColorFor,
  type IndicatorId,
  type MultiLineId,
  type SingleColorId,
} from "@/utils/indicatorConfig";

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
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
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
        className="w-16 rounded border border-border-primary bg-transparent px-1 py-0.5 text-xs text-text-primary outline-none"
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

// Editable list of length chips for SMA / EMA. Each chip carries an editable
// color swatch (defaults to the auto-cycled palette).
function PeriodChips({ id }: { id: MultiLineId }) {
  const periods = useIndicators((s) => s[id].periods);
  const colors = useIndicators((s) => s[id].colors);
  const addPeriod = useIndicators((s) => s.addPeriod);
  const removePeriod = useIndicators((s) => s.removePeriod);
  const setPeriodColor = useIndicators((s) => s.setPeriodColor);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {periods.map((p, idx) => {
        const color = maColorFor(colors, p, idx);
        return (
          <span
            key={p}
            className="flex items-center gap-1 rounded-full border border-border-primary px-2 py-0.5 text-xs font-medium"
            style={{ color }}
          >
            <ColorControl
              value={color}
              onChange={(hex) => setPeriodColor(id, p, hex)}
              label={`${id.toUpperCase()} ${p} color`}
              size="sm"
            />
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
        );
      })}
      <PeriodAdder onAdd={(v) => addPeriod(id, v)} />
    </div>
  );
}

// A color swatch for a single-line indicator (Bollinger / Donchian / RSI/VWAP).
function LineColorRow({ id }: { id: SingleColorId }) {
  const color = useIndicators((s) => s[id].color) ?? INDICATOR_COLORS[id];
  const setLineColor = useIndicators((s) => s.setLineColor);
  return (
    <div className="flex items-center justify-between text-xs text-text-secondary">
      Color
      <ColorControl
        value={color}
        onChange={(hex) => setLineColor(id, hex)}
        label={`${id} color`}
        size="sm"
      />
    </div>
  );
}

function SettingsBody({ id, isIntraday }: { id: IndicatorId; isIntraday: boolean }) {
  const s = useIndicators();

  switch (id) {
    case "sma":
    case "ema":
      return (
        <>
          <p className="text-xs text-text-tertiary">
            Lengths{id === "ema" ? " (drawn dashed)" : ""}
          </p>
          <PeriodChips id={id} />
        </>
      );

    case "bollinger":
      return (
        <>
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
          <LineColorRow id="bollinger" />
        </>
      );

    case "donchian":
      return (
        <>
          <NumberField
            label="Length"
            value={s.donchian.period}
            bounds={PARAM_BOUNDS.period}
            onChange={(v) => s.setParam("donchian", "period", v)}
          />
          <LineColorRow id="donchian" />
        </>
      );

    case "rsi":
      return (
        <>
          <NumberField
            label="Length"
            value={s.rsi.period}
            bounds={PARAM_BOUNDS.period}
            onChange={(v) => s.setParam("rsi", "period", v)}
          />
          <LineColorRow id="rsi" />
        </>
      );

    case "vwap":
      return (
        <>
          {/* Session-anchored VWAP only means something intraday — on daily
              candles each bar is its own session, so force rolling there. */}
          <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
            Anchor
            <select
              value={isIntraday ? s.vwap.anchor : "rolling"}
              disabled={!isIntraday}
              onChange={(e) =>
                s.setVwapAnchor(e.target.value as "session" | "rolling")
              }
              className="rounded border border-border-primary bg-bg-secondary px-1 py-0.5 text-xs text-text-primary disabled:opacity-50"
            >
              <option value="session">Session</option>
              <option value="rolling">Rolling</option>
            </select>
          </label>
          {(!isIntraday || s.vwap.anchor === "rolling") && (
            <NumberField
              label="Length"
              value={s.vwap.period}
              bounds={PARAM_BOUNDS.period}
              onChange={(v) => s.setParam("vwap", "period", v)}
            />
          )}
          <LineColorRow id="vwap" />
        </>
      );

    case "volumeProfile":
      return (
        <>
          <NumberField
            label="Rows"
            value={s.volumeProfile.rows}
            bounds={PARAM_BOUNDS.rows}
            onChange={(v) => s.setVpRows(v)}
          />
          <label className="flex items-center justify-between text-xs text-text-secondary">
            Value area
            <input
              type="checkbox"
              checked={s.volumeProfile.showValueArea}
              onChange={() => s.toggleVpValueArea()}
              className="h-3.5 w-3.5 accent-green-primary"
            />
          </label>
        </>
      );

    // Volume bars follow the candle colors (Style menu) and sessions is plain
    // shading, so neither has anything to configure here.
    default:
      return (
        <p className="text-xs text-text-tertiary">Nothing to configure.</p>
      );
  }
}

export function IndicatorSettingsPopover({
  id,
  title,
  isIntraday,
  onClose,
}: {
  id: IndicatorId;
  title: string;
  isIntraday: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      // Stops a click inside from reaching the chart's pan/draw handlers.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 left-full z-30 ml-2 flex w-52 flex-col gap-2 rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="text-text-tertiary hover:text-text-primary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <SettingsBody id={id} isIntraday={isIntraday} />
    </div>
  );
}
