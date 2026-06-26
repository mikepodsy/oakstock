"use client";

import { useEffect, useRef, useState } from "react";
import { SWATCHES } from "@/stores/chartStyleStore";

interface ColorControlProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  // Visual size of the swatch button. "sm" suits inline chips.
  size?: "sm" | "md";
}

// A single color control: a swatch button that opens an inline row of standard
// presets plus a native color-wheel picker and a hex field. Shared by the chart
// style menu and the indicators menu.
export function ColorControl({ value, onChange, label, size = "md" }: ColorControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Close the picker on outside-click / Escape so it doesn't linger when the
  // parent popover stays open.
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

  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`${dim} rounded border border-border-primary`}
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-border-primary bg-bg-elevated p-2 shadow-lg">
          <div className="mb-2 flex flex-wrap gap-1">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`h-5 w-5 rounded border ${
                  value.toLowerCase() === c.toLowerCase()
                    ? "border-text-primary"
                    : "border-border-primary"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nativeRef.current?.click()}
              className="text-[11px] text-text-secondary hover:text-text-primary"
            >
              Custom
            </button>
            <input
              ref={nativeRef}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border border-border-primary bg-transparent p-0"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="w-16 rounded border border-border-primary bg-transparent px-1 py-0.5 text-[11px] text-text-primary outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
