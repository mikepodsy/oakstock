"use client";

import { formatCurrency } from "@/utils/formatters";
import { placeStrikeTooltip } from "@/utils/strikeHover";

export interface StrikeTooltipRow {
  label: string;
  value: string;
  color?: string;
}

interface StrikeTooltipProps {
  /** Strike price of the hovered bar — the headline of the popup. */
  strike: number;
  rows: StrikeTooltipRow[];
  /** Pointer position, in CSS pixels relative to the panel. */
  x: number;
  y: number;
  panelW: number;
  panelH: number;
}

const TIP_W = 132;
const ROW_H = 15;
const CHROME_H = 30; // padding + the strike headline

/**
 * The popup shown while hovering a strike panel: the price level the bar sits
 * at, plus its values. Positioned inside the panel next to the cursor, so it
 * never escapes the histogram it belongs to.
 */
export function StrikeTooltip({
  strike,
  rows,
  x,
  y,
  panelW,
  panelH,
}: StrikeTooltipProps) {
  const tipH = CHROME_H + rows.length * ROW_H;
  const { left, top } = placeStrikeTooltip({
    x,
    y,
    panelW,
    panelH,
    tipW: TIP_W,
    tipH,
  });

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-border-primary bg-bg-elevated/95 px-2 py-1.5 shadow-lg backdrop-blur"
      style={{ left, top, width: TIP_W }}
    >
      <div className="font-financial text-[11px] font-semibold text-text-primary">
        {formatCurrency(strike)}
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-1.5 leading-[15px]">
          {row.color && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          )}
          <span className="text-[10px] text-text-tertiary">{row.label}</span>
          <span className="font-financial ml-auto text-[10px] text-text-primary">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
