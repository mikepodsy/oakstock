"use client";

// The Indicators button and the modal behind it.
//
// The modal only picks indicators — star them, search them, switch them on and
// off. Everything configurable about an indicator lives on its legend row's
// gear (IndicatorSettingsPopover), next to the line it affects.

import { useState } from "react";
import { Check, ChevronDown, Search, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIndicators } from "./ChartConfigContext";
import { useIndicatorFavoritesStore } from "@/stores/indicatorFavoritesStore";
import {
  INDICATOR_CATALOG,
  INDICATOR_CATEGORIES,
  countActive,
  matchesQuery,
  type CatalogEntry,
  type IndicatorCategory,
} from "@/utils/indicatorCatalog";

type Section = IndicatorCategory | "favorites";

interface IndicatorPickerDialogProps {
  // Session shading and the relevance of intraday-only features depend on this.
  isIntraday: boolean;
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-bg-elevated text-text-primary"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className="text-text-tertiary">{icon}</span>
      {label}
    </button>
  );
}

function IndicatorRow({
  entry,
  isIntraday,
}: {
  entry: CatalogEntry;
  isIntraday: boolean;
}) {
  const enabled = useIndicators((s) => s[entry.id]?.enabled ?? false);
  const toggle = useIndicators((s) => s.toggle);
  const favorites = useIndicatorFavoritesStore((s) => s.favorites);
  const toggleFavorite = useIndicatorFavoritesStore((s) => s.toggleFavorite);
  const favorite = favorites.includes(entry.id);

  // Session shading has nothing to draw on daily and above, so the row stays
  // visible (it explains itself) but can't be switched on.
  const selectable = !entry.intradayOnly || isIntraday;

  return (
    <div
      className={`group/row flex items-center gap-2 rounded-md px-2 py-1.5 ${
        selectable ? "hover:bg-bg-elevated" : "opacity-60"
      }`}
    >
      <button
        type="button"
        onClick={() => toggleFavorite(entry.id)}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${entry.label}`}
        aria-pressed={favorite}
        className={`cursor-pointer transition-opacity ${
          favorite
            ? "text-amber-400 opacity-100"
            : "text-text-tertiary opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={favorite ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        disabled={!selectable}
        onClick={() => toggle(entry.id)}
        className="flex flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed"
      >
        <span className="flex-1">
          <span className="block text-sm text-text-primary">{entry.label}</span>
          {entry.blurb && (
            <span className="block text-[11px] text-text-tertiary">
              {selectable ? entry.blurb : "Intraday intervals only"}
            </span>
          )}
        </span>
        {enabled && selectable && (
          <Check className="h-4 w-4 shrink-0 text-green-primary" />
        )}
      </button>
    </div>
  );
}

export function IndicatorPickerDialog({ isIntraday }: IndicatorPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("overlays");
  const [query, setQuery] = useState("");

  const indicators = useIndicators();
  const favorites = useIndicatorFavoritesStore((s) => s.favorites);
  const activeCount = countActive(indicators, isIntraday);

  const inSection =
    section === "favorites"
      ? INDICATOR_CATALOG.filter((e) => favorites.includes(e.id))
      : INDICATOR_CATALOG.filter((e) => e.category === section);

  const rows = inSection
    .filter((e) => matchesQuery(e, query))
    .sort((a, b) => a.label.localeCompare(b.label));

  const sectionLabel =
    section === "favorites"
      ? "Favorites"
      : INDICATOR_CATEGORIES.find((c) => c.id === section)!.label;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-border-primary bg-bg-secondary p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border-primary px-4 py-3">
            <DialogTitle>Indicators</DialogTitle>
          </DialogHeader>

          <div className="flex h-[26rem] min-h-0">
            <nav className="w-44 shrink-0 space-y-1 border-r border-border-primary p-2">
              <p className="px-2 pt-1 pb-1 text-[10px] font-medium tracking-wide text-text-tertiary uppercase">
                Personal
              </p>
              <SidebarButton
                active={section === "favorites"}
                onClick={() => setSection("favorites")}
                icon={<Star className="h-3.5 w-3.5" />}
                label="Favorites"
              />
              <p className="px-2 pt-3 pb-1 text-[10px] font-medium tracking-wide text-text-tertiary uppercase">
                Built-in
              </p>
              {INDICATOR_CATEGORIES.map((c) => (
                <SidebarButton
                  key={c.id}
                  active={section === c.id}
                  onClick={() => setSection(c.id)}
                  icon={<span className="text-xs">{CATEGORY_GLYPH[c.id]}</span>}
                  label={c.label}
                />
              ))}
            </nav>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-border-primary px-3 py-2">
                <Search className="h-3.5 w-3.5 text-text-tertiary" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${sectionLabel.toLowerCase()}`}
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <p className="px-2 pb-1 text-[10px] font-medium tracking-wide text-text-tertiary uppercase">
                  {sectionLabel}
                </p>

                {rows.map((entry) => (
                  <IndicatorRow
                    key={entry.id}
                    entry={entry}
                    isIntraday={isIntraday}
                  />
                ))}

                {rows.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-text-tertiary">
                    {section === "favorites" && !query
                      ? "No favorites yet. Star an indicator to keep it here."
                      : "No indicators match that search."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Sidebar glyphs, matching the shape each category draws on the chart.
const CATEGORY_GLYPH: Record<IndicatorCategory, string> = {
  overlays: "〜",
  volume: "▮",
  oscillators: "◷",
};
