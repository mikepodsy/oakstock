"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Check, RotateCcw } from "lucide-react";
import { useChartStyleStore, type ColorGroupId } from "@/stores/chartStyleStore";
import { ColorControl } from "./ColorControl";

// Small checkbox matching the IndicatorsMenu styling.
function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? "border-transparent bg-green-primary" : "border-border-primary"
      }`}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </button>
  );
}

// A Body / Borders / Wick row: visibility toggle + up & down color controls.
function CandlePartRow({ id, label }: { id: ColorGroupId; label: string }) {
  const group = useChartStyleStore((s) => s[id]);
  const setColor = useChartStyleStore((s) => s.setColor);
  const toggleVisible = useChartStyleStore((s) => s.toggleVisible);

  return (
    <div className="flex items-center gap-2 py-1">
      <CheckBox checked={group.visible} onChange={() => toggleVisible(id)} />
      <span className="flex-1 text-sm text-text-primary">{label}</span>
      <ColorControl
        value={group.up}
        onChange={(hex) => setColor(id, "up", hex)}
        label={`${label} up`}
      />
      <ColorControl
        value={group.down}
        onChange={(hex) => setColor(id, "down", hex)}
        label={`${label} down`}
      />
    </div>
  );
}

function OpacitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 text-xs text-text-secondary">
      <span className="flex-1">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-24 accent-green-primary"
      />
      <span className="w-9 text-right text-text-primary">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}

export function ChartStyleMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const background = useChartStyleStore((s) => s.background);
  const candleUpOpacity = useChartStyleStore((s) => s.candleUpOpacity);
  const candleDownOpacity = useChartStyleStore((s) => s.candleDownOpacity);
  const backgroundOpacity = useChartStyleStore((s) => s.backgroundOpacity);
  const setBackground = useChartStyleStore((s) => s.setBackground);
  const setOpacity = useChartStyleStore((s) => s.setOpacity);
  const reset = useChartStyleStore((s) => s.reset);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Chart style"
        aria-label="Chart style"
        className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-transparent border border-border-primary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-border-primary bg-bg-elevated p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between px-0.5">
            <span className="text-xs font-medium text-text-tertiary">Candles</span>
            <span className="flex gap-2 pr-0.5 text-[10px] text-text-tertiary">
              <span className="w-5 text-center">Up</span>
              <span className="w-5 text-center">Down</span>
            </span>
          </div>

          <CandlePartRow id="body" label="Body" />
          <CandlePartRow id="border" label="Borders" />
          <CandlePartRow id="wick" label="Wick" />

          <div className="my-1 border-t border-border-primary" />

          <div className="flex items-center gap-2 py-1">
            <span className="flex-1 text-sm text-text-primary">Background</span>
            <ColorControl
              value={background}
              onChange={setBackground}
              label="Background"
            />
          </div>

          <div className="my-1 border-t border-border-primary" />

          <OpacitySlider
            label="Up candle opacity"
            value={candleUpOpacity}
            onChange={(v) => setOpacity("candleUpOpacity", v)}
          />
          <OpacitySlider
            label="Down candle opacity"
            value={candleDownOpacity}
            onChange={(v) => setOpacity("candleDownOpacity", v)}
          />
          <OpacitySlider
            label="Background opacity"
            value={backgroundOpacity}
            onChange={(v) => setOpacity("backgroundOpacity", v)}
          />

          <div className="my-1 border-t border-border-primary" />

          <button
            type="button"
            onClick={reset}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border-primary py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
