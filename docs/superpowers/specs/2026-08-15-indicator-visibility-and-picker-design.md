# Indicator visibility toggles and a TradingView-style picker

**Date:** 2026-08-15
**Status:** Approved

## Problem

Two gaps against how TradingView handles indicators:

1. The chart legend is read-only. Muting an SMA line means opening the Indicators
   dropdown and unchecking it, which for SMA/EMA also deletes the length and its
   custom color. There is no quick way to hide a line and get it back.
2. The Indicators dropdown is a flat checklist. There is no search, no way to
   mark the indicators you actually use, and settings, selection and toggling
   are all crammed into one narrow panel.

## Goals

- An eye control on every legend row that hides the line without discarding its
  configuration.
- An indicator picker modal with a category sidebar, search and starred
  favorites.
- No behavioral drift between stock-page charts (global persisted store) and
  dashboard tiles (per-tile config).

## Non-goals

- Adding new indicators. The catalog covers the nine that exist.
- Multiple instances of the same indicator (TradingView allows two RSIs with
  different lengths; SMA/EMA already cover the multi-length case via `periods`).
- Custom/community scripts. The sidebar shows only what we ship.

## Design

### 1. Visibility state

`IndicatorState` gains one field:

```ts
hidden: string[];   // legend keys: "sma:20", "ema:12", "bollinger", "rsi", ...
```

A flat list rather than a `hidden` flag on each sub-object, for two reasons:
state persisted before this change needs exactly one guard (`s.hidden ?? []`),
and SMA/EMA visibility is per-length, which a per-indicator flag cannot express.

Key format: `"sma:<period>"` and `"ema:<period>"` for the multi-line indicators,
the bare indicator id for everything else.

New pure reducers in `src/utils/indicatorConfig.ts`, alongside the existing ones:

- `toggleHidden(s, key): IndicatorState`
- `isHidden(s, key): boolean` — guards `hidden` being absent on older state.

Two existing reducers grow cleanup:

- `removePeriod` drops `"<id>:<period>"` from `hidden`. Removing the *last*
  length also switches the indicator off: an enabled indicator with no lengths
  draws nothing and has no legend row to reach its settings from, so the picker
  needs to be the way back in.
- `toggleIndicator` drops the indicator's key and (for SMA/EMA) every
  `"<id>:*"` key — in both directions, so a stale key from an older build can
  never silently mute a freshly added indicator.

So re-adding an indicator or a length always comes back visible. Because both
the persisted store (`src/stores/indicatorStore.ts`) and the per-tile config
(`ChartConfigContext`) wrap the same reducers, both get this for free; the store
also persists `hidden` via `partialize`.

**Eye is not the checkbox.** The eye flips `hidden`; the picker flips `enabled`.
A hidden indicator is still active — it keeps its row, dimmed.

### 2. Legend

Legend construction moves out of `CandlestickChart.tsx` (1900+ lines) into a
pure, testable module:

**`src/utils/chartLegend.ts`**

```ts
export interface LegendRow {
  key: string;            // the visibility key, also the React key
  id: keyof IndicatorState;  // which indicator's settings the gear opens
  period?: number;        // set for sma/ema rows, so × removes one length
  label: string;          // "SMA 20", "BB 20, 2", "Volume"
  color: string;
  dashed?: boolean;
  hidden: boolean;
}

export function buildLegendRows(s: IndicatorState): LegendRow[];
```

Order: SMA lengths, EMA lengths, Bollinger, Donchian, VWAP, RSI, Volume, Volume
Profile. Trading Sessions is excluded — it is background shading with no line to
distinguish, and hiding it is the same as switching it off.

**`src/components/charts/ChartLegend.tsx`** renders the rows in the existing
top-left overlay position. Each row is `swatch · label · 👁 · ⚙ · ×`; the three
controls appear on row hover (and on focus, for keyboard users) so the resting
legend stays as quiet as it is today. Hidden rows render dimmed with an
eye-with-slash and stay visible at rest.

**`src/components/charts/IndicatorSettingsPopover.tsx`** is what the gear opens:
a small anchored panel with that indicator's settings. `NumberField`,
`PeriodChips`, `PeriodAdder` and `LineColorControl` move here from
`IndicatorsMenu.tsx` unchanged.

SMA and EMA produce several rows from one indicator. Per row: the eye hides that
length only, `×` removes that length only, and the gear opens the shared SMA (or
EMA) settings showing all of its lengths.

### 3. Renderer

`CandlestickChart.tsx` computes derived visibility next to the existing
`useIndicators` selectors:

```ts
const visibleSmaPeriods = smaCfg.enabled
  ? smaCfg.periods.filter((p) => !isHidden(s, `sma:${p}`))
  : [];
const rsiVisible = rsiCfg.enabled && !isHidden(s, "rsi");
// ...one per indicator
```

The five draw sites consume these instead of reading `enabled`/`periods`
directly. Nothing inside the drawing logic changes, and a hidden RSI or Volume
collapses its pane exactly as disabling it does.

Note the moving-average color must stay bound to the length's index in the full
`periods` array, not its index after filtering — otherwise hiding SMA 20
recolors SMA 50. `LegendRow.color` and the renderer both resolve color through
`maColorFor(colors, period, indexInFullPeriods)`.

### 4. Picker modal

`IndicatorsMenu.tsx` is replaced by
**`src/components/charts/IndicatorPickerDialog.tsx`**: the same trigger button
(label, active-count badge) now opens a `Dialog` from `src/components/ui/dialog.tsx`,
laid out as sidebar + search + list.

**`src/utils/indicatorCatalog.ts`** is the single source of list metadata:

```ts
interface CatalogEntry {
  id: keyof IndicatorState;
  label: string;              // "Bollinger Bands"
  category: "overlays" | "volume" | "oscillators";
  keywords: string[];         // "bb", "bands" — searchable aliases
  intradayOnly?: boolean;     // sessions
}
```

- **Overlays** — SMA, EMA, Bollinger Bands, Donchian Channels, VWAP, Trading
  Sessions
- **Volume** — Volume, Volume Profile
- **Oscillators** — RSI

Sidebar: `PERSONAL → Favorites`, `BUILT-IN → Overlays / Volume / Oscillators`.
Rows are alphabetical within a category and carry a star on the left (filled
when favorited, outline on hover) and a check when the indicator is active.
Clicking a row toggles `enabled`. Search filters within the selected category on
label and keywords. Favorites shows an empty state pointing at the star.

Trading Sessions on a non-intraday interval stays visible but disabled, with the
"Intraday intervals only" note it has today.

**`src/stores/indicatorFavoritesStore.ts`** — a persisted `string[]` of indicator
ids with `toggleFavorite`. Favorites are user-level and shared across every
chart and dashboard tile, unlike indicator config which is per-tile. Separate
store, separate localStorage key (`oakstock-indicator-favorites`).

The modal contains no settings. Settings live on the legend gear.

## Testing

Vitest, colocated with the modules under test:

- `indicatorConfig.test.ts` — `toggleHidden` / `isHidden`; `hidden` cleanup on
  `removePeriod` and on disabling via `toggleIndicator`; `isHidden` on state
  with no `hidden` field; no input mutation.
- `chartLegend.test.ts` — row order; SMA/EMA expansion to one row per length;
  disabled indicators omitted; hidden indicators present with `hidden: true`;
  colors stable when an earlier length is hidden; sessions never emitted.
- `indicatorCatalog.test.ts` — every `IndicatorState` key has exactly one
  catalog entry (guards a future indicator being added without a list row).

Then `npm run test`, `npm run lint`, `npm run build`, and driving the app to
confirm the eye mutes a line, the gear edits it, and the modal picks and stars.

## Risks

- **Persisted state.** Existing users have `oakstock-indicators` in localStorage
  with no `hidden`. Every read goes through `isHidden`, which guards it.
- **Dashboard tiles.** Tile configs are stored in `dashboardLayoutStore` as
  `IndicatorState` snapshots and will also lack `hidden` — same guard covers it.
- **Legend density.** Adding RSI, Volume and Volume Profile makes the legend up
  to eight rows. Controls are hover-only to keep the resting state calm.
