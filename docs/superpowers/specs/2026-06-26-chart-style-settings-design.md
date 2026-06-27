# Chart Style Settings — Design

Date: 2026-06-26
Branch: `feat/questrade-candlestick-chart`

## Goal

Give the individual-stock candlestick chart a settings panel for customizing
candle and background appearance: per-side colors for the candle body, borders,
and wicks; a chart background color; and opacity for both the candle body fill
and the background. Each color control offers a row of standard preset swatches
plus a custom color-wheel picker.

## Scope

In scope:

- TradingView-style granularity: separate **up** and **down** colors for
  **Body**, **Borders**, and **Wick** (6 colors), each group independently
  toggleable (visible on/off).
- A **Background** color.
- **Candle opacity** (body fill alpha) and **Background opacity** sliders.
- Standard swatch row + custom picker (native color wheel + hex) per color.
- **Reset to defaults**.
- Global scope — one setting applies to every stock chart, matching how theme
  and indicators already persist.

Out of scope (explicitly excluded):

- "Color bars based on previous close" toggle (shown in the reference image but
  not requested; adds real complexity).
- Per-ticker styling.
- Styling the Line chart type beyond its current behavior.

## Architecture

Follows the existing `indicatorStore` + `IndicatorsMenu` pattern.

### Store — `src/stores/chartStyleStore.ts`

Persisted Zustand store (`persist`, name `oakstock-chart-style`).

State shape:

```ts
type ColorGroup = { up: string; down: string; visible: boolean };

interface ChartStyleState {
  body: ColorGroup;       // candle body fill, up/down
  border: ColorGroup;     // candle border, up/down
  wick: ColorGroup;       // candle wick, up/down
  background: string;      // chart background hex
  candleOpacity: number;  // 0..1, alpha applied to body fill colors
  backgroundOpacity: number; // 0..1, alpha applied to background color
}
```

Defaults reproduce today's look so the chart is visually unchanged until the
user opts in:

- `body`/`border`/`wick`: `{ up: "#22C55E", down: "#EF4444", visible: ... }`
  - body visible `true`, border visible `false` (current `borderVisible: false`),
    wick visible `true`.
- `background`: `"#000000"`.
- `candleOpacity`: `1`, `backgroundOpacity`: `1`.

Actions: `setColor(group, side, hex)`, `toggleVisible(group)`,
`setBackground(hex)`, `setOpacity(which, value)`, `reset()`.
`partialize` persists only data, not actions (mirrors `indicatorStore`).

A small helper `withAlpha(hex, alpha)` converts a hex color + 0..1 alpha into an
`rgba()` string for lightweight-charts.

### Component — `src/components/charts/ChartStyleMenu.tsx`

A gear-icon (`Settings` from lucide-react) button in the chart toolbar, beside
`IndicatorsMenu`. Opens a popover using the same pattern as `IndicatorsMenu`
(absolute panel, close on outside-click and Escape).

Panel contents:

- Rows for **Body**, **Borders**, **Wick**: a visibility checkbox (reusing the
  existing checkbox styling) and two color controls (up, down).
- **Background** row: one color control.
- A reusable `ColorControl` sub-component: shows the current color as a swatch
  button; clicking opens an inline row of ~7 standard preset swatches plus a
  "custom" entry that triggers a hidden `<input type="color">` (native wheel) and
  a hex text input. No new dependency.
- Two range sliders: **Candle opacity** and **Background opacity** (0–100%).
- **Reset to defaults** button.

Preset swatch palette (shared constant): a small set of common trading colors,
e.g. green `#22C55E`, red `#EF4444`, blue `#3B82F6`, amber `#F59E0B`, purple
`#A855F7`, white `#F0EDE8`, black `#000000`.

### Chart integration — `src/components/charts/CandlestickChart.tsx`

- Read the style store; subscribe to it.
- The create effect seeds candle body/border/wick colors and the layout
  background from the store (resolving alpha) instead of only CSS vars. Bars map
  to body up/down; line keeps its current `--text-primary` color.
- A new `useEffect` keyed on the style state applies changes to the **existing**
  chart/series without recreating them:
  - `candleSeries.applyOptions({ upColor, downColor, borderVisible,
    borderUpColor, borderDownColor, wickVisible, wickUpColor, wickDownColor })`
    where body up/down use `withAlpha(..., candleOpacity)`.
  - `chart.applyOptions({ layout: { background: { color:
    withAlpha(background, backgroundOpacity) } } })`.
- This keeps color edits live (no flicker, viewport preserved). The existing
  recreate-on-theme/chartType behavior is unchanged; after a recreate the same
  style effect re-applies because the store value is in its dependency list.

## Data flow

User edits a control → store action → persisted to localStorage → style
`useEffect` fires → `applyOptions` on live chart/series → candles repaint.

## Error / edge handling

- `withAlpha` guards malformed hex (falls back to the raw input).
- Opacity sliders clamp to 0..1.
- Background opacity < 1 lets the page background show through the canvas (the
  chart container sits on `--bg-primary`); acceptable and intended.
- Defaults equal current appearance, so existing users see no change until they
  customize; `reset()` returns to these.

## Testing / verification

No test runner exists in the project. Verify via `npm run build` (typecheck)
and `npm run lint`, plus manual check that: candles render unchanged by default,
each color/visibility/opacity control updates the chart live, settings persist
across reload, and Reset restores defaults.
