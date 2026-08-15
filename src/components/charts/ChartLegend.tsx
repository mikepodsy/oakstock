"use client";

// The on-chart legend: one row per active indicator line, each with controls to
// mute it (eye), configure it (gear) or drop it (×).
//
// Rows come from the pure builder in utils/chartLegend so ordering, labels and
// colors stay testable. Controls only appear on hover/focus so the resting
// legend stays as quiet as it was when it was a plain list.

import { useState } from "react";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { useIndicators } from "./ChartConfigContext";
import { IndicatorSettingsPopover } from "./IndicatorSettingsPopover";
import { buildLegendRows, type LegendRow } from "@/utils/chartLegend";
import { INDICATOR_LABELS } from "@/utils/indicatorCatalog";

function LegendRowItem({
  row,
  isIntraday,
  openSettings,
  onToggleSettings,
}: {
  row: LegendRow;
  isIntraday: boolean;
  openSettings: boolean;
  onToggleSettings: () => void;
}) {
  const toggleHidden = useIndicators((s) => s.toggleHidden);
  const toggle = useIndicators((s) => s.toggle);
  const removePeriod = useIndicators((s) => s.removePeriod);

  // × on a moving-average row drops just that length; everywhere else there is
  // only one line, so it switches the whole indicator off.
  const remove = () => {
    if (row.period !== undefined && (row.id === "sma" || row.id === "ema")) {
      removePeriod(row.id, row.period);
    } else {
      toggle(row.id);
    }
  };

  return (
    <div
      className={`group/legend relative flex items-center gap-1.5 text-[11px] ${
        row.hidden ? "text-text-tertiary" : "text-text-secondary"
      }`}
    >
      <span
        className="inline-block w-3 shrink-0"
        style={{
          borderTop: `2px ${row.dashed ? "dashed" : "solid"} ${row.color}`,
          opacity: row.hidden ? 0.4 : 1,
        }}
      />
      <span className={row.hidden ? "line-through decoration-1" : undefined}>
        {row.label}
      </span>

      {/* Reserved inline so revealing the controls never reflows the legend. */}
      <span
        className={`ml-auto flex items-center gap-0.5 pl-1 transition-opacity ${
          openSettings
            ? "opacity-100"
            : "opacity-0 group-hover/legend:opacity-100 focus-within:opacity-100"
        }`}
        // The chart canvas below handles pan and drawing; these must not reach it.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => toggleHidden(row.key)}
          title={row.hidden ? "Show" : "Hide"}
          aria-label={`${row.hidden ? "Show" : "Hide"} ${row.label}`}
          aria-pressed={row.hidden}
          className="text-text-tertiary transition-colors hover:text-text-primary"
        >
          {row.hidden ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleSettings}
          title="Settings"
          aria-label={`${row.label} settings`}
          aria-expanded={openSettings}
          className="text-text-tertiary transition-colors hover:text-text-primary"
        >
          <Settings2 className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={remove}
          title="Remove"
          aria-label={`Remove ${row.label}`}
          className="text-text-tertiary transition-colors hover:text-red-primary"
        >
          <X className="h-3 w-3" />
        </button>
      </span>

      {openSettings && (
        <IndicatorSettingsPopover
          id={row.id}
          title={INDICATOR_LABELS[row.id]}
          isIntraday={isIntraday}
          onClose={onToggleSettings}
        />
      )}
    </div>
  );
}

export function ChartLegend({ isIntraday }: { isIntraday: boolean }) {
  const indicators = useIndicators();
  // Which row's settings popover is open, by legend key. SMA/EMA rows share one
  // settings panel, so opening it from any of their rows is the same panel.
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = buildLegendRows(indicators);
  if (rows.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 rounded-md bg-bg-elevated/70 px-2 py-1 backdrop-blur">
      {rows.map((row) => (
        <LegendRowItem
          key={row.key}
          row={row}
          isIntraday={isIntraday}
          openSettings={openKey === row.key}
          onToggleSettings={() =>
            setOpenKey((k) => (k === row.key ? null : row.key))
          }
        />
      ))}
    </div>
  );
}
