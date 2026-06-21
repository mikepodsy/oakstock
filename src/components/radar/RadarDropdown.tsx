"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface RadarDropdownOption {
  key: string;
  label: string;
}

interface RadarDropdownProps {
  value: string;
  options: RadarDropdownOption[];
  onChange: (key: string) => void;
  disabled?: boolean;
  minWidthClass?: string;
  title?: string;
}

export function RadarDropdown({
  value,
  options,
  onChange,
  disabled = false,
  minWidthClass = "min-w-[180px]",
  title,
}: RadarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.key === value);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-border-primary transition-colors text-sm font-medium text-text-primary ${minWidthClass} ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-green-primary/50"
        }`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        <ChevronDown
          className={`h-4 w-4 text-text-tertiary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl bg-bg-secondary border border-border-primary shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.key === value
                  ? "bg-green-primary/10 text-green-primary font-medium"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
