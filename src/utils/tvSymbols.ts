// TradingView symbol catalog + the mappings between our chart config and the
// Advanced Chart widget's config.
//
// A curated catalog is necessary because /api/search (Yahoo) filters results to
// `EQUITY | ETF`, so it can't return futures, rate or FX symbols at all. These
// are exchange-qualified TradingView tickers; continuous front-month contracts
// use the `1!` suffix.

import type { ChartStyleState } from "@/stores/chartStyleStore";
import { withAlpha } from "@/stores/chartStyleStore";
import type { IndicatorState } from "@/utils/indicatorConfig";

export interface TvSymbol {
  /** Exchange-qualified TradingView symbol. */
  symbol: string;
  label: string;
}

export interface TvSymbolGroup {
  group: string;
  symbols: TvSymbol[];
}

export const TV_SYMBOL_GROUPS: TvSymbolGroup[] = [
  {
    group: "Index futures",
    symbols: [
      { symbol: "CME_MINI:ES1!", label: "E-mini S&P 500" },
      { symbol: "CME_MINI:NQ1!", label: "E-mini Nasdaq 100" },
      { symbol: "CME_MINI:RTY1!", label: "E-mini Russell 2000" },
      { symbol: "CBOT_MINI:YM1!", label: "E-mini Dow" },
    ],
  },
  {
    group: "Rates & bonds",
    symbols: [
      { symbol: "CBOT:ZB1!", label: "30Y T-Bond" },
      { symbol: "CBOT:ZN1!", label: "10Y T-Note" },
      { symbol: "CBOT:ZF1!", label: "5Y T-Note" },
      { symbol: "CBOT:ZT1!", label: "2Y T-Note" },
      { symbol: "TVC:US10Y", label: "US 10Y yield" },
      { symbol: "TVC:US02Y", label: "US 2Y yield" },
    ],
  },
  {
    group: "Metals",
    symbols: [
      { symbol: "COMEX:GC1!", label: "Gold" },
      { symbol: "COMEX:SI1!", label: "Silver" },
      { symbol: "COMEX:HG1!", label: "Copper" },
      { symbol: "AMEX:GLD", label: "GLD (gold ETF)" },
    ],
  },
  {
    group: "Energy",
    symbols: [
      { symbol: "NYMEX:CL1!", label: "WTI crude" },
      { symbol: "NYMEX:NG1!", label: "Natural gas" },
      { symbol: "AMEX:XLE", label: "XLE (energy)" },
    ],
  },
  {
    group: "Macro",
    symbols: [
      { symbol: "TVC:DXY", label: "Dollar index" },
      { symbol: "TVC:VIX", label: "VIX" },
      { symbol: "FX:EURUSD", label: "EUR/USD" },
      { symbol: "FX:USDJPY", label: "USD/JPY" },
    ],
  },
  {
    group: "ETFs",
    symbols: [
      { symbol: "AMEX:SPY", label: "SPY" },
      { symbol: "NASDAQ:QQQ", label: "QQQ" },
      { symbol: "NASDAQ:TLT", label: "TLT (20y+ treasuries)" },
      { symbol: "NASDAQ:IEF", label: "IEF (7-10y treasuries)" },
      { symbol: "AMEX:RSP", label: "RSP (equal weight)" },
    ],
  },
];

/** Flat lookup for resolving a stored symbol back to its display label. */
const LABELS = new Map(
  TV_SYMBOL_GROUPS.flatMap((g) => g.symbols.map((s) => [s.symbol, s.label] as const))
);

export function tvLabelFor(symbol: string): string {
  return LABELS.get(symbol) ?? symbol;
}

// --- Intervals -------------------------------------------------------------

export interface TvInterval {
  /** TradingView resolution code. */
  value: string;
  label: string;
}

export const TV_INTERVALS: TvInterval[] = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
  { value: "M", label: "1M" },
];

export function tvIntervalLabel(value: string): string {
  return TV_INTERVALS.find((i) => i.value === value)?.label ?? value;
}

// --- Chart type ------------------------------------------------------------

// TradingView's numeric chart styles: 1 = candles, 0 = bars, 2 = line.
const TV_CHART_STYLE: Record<"candles" | "bars" | "line", number> = {
  candles: 1,
  bars: 0,
  line: 2,
};

export function tvChartStyle(type: "candles" | "bars" | "line"): number {
  return TV_CHART_STYLE[type];
}

// --- Style -> widget overrides ---------------------------------------------

/**
 * Maps our ChartStyleState onto TradingView's `overrides`, so a tile's candle
 * colors match whatever the user picked in the shared color menu.
 *
 * Hidden borders/wicks are approximated by painting them the body color —
 * the widget has no per-part visibility flag the way lightweight-charts does.
 */
export function tvOverrides(style: ChartStyleState): Record<string, string | boolean> {
  const bodyUp = withAlpha(style.body.up, style.candleUpOpacity);
  const bodyDown = withAlpha(style.body.down, style.candleDownOpacity);
  const borderUp = style.border.visible ? style.border.up : style.body.up;
  const borderDown = style.border.visible ? style.border.down : style.body.down;
  const wickUp = style.wick.visible ? style.wick.up : style.body.up;
  const wickDown = style.wick.visible ? style.wick.down : style.body.down;

  return {
    "mainSeriesProperties.candleStyle.upColor": bodyUp,
    "mainSeriesProperties.candleStyle.downColor": bodyDown,
    "mainSeriesProperties.candleStyle.drawBorder": style.border.visible,
    "mainSeriesProperties.candleStyle.borderUpColor": borderUp,
    "mainSeriesProperties.candleStyle.borderDownColor": borderDown,
    "mainSeriesProperties.candleStyle.drawWick": style.wick.visible,
    "mainSeriesProperties.candleStyle.wickUpColor": wickUp,
    "mainSeriesProperties.candleStyle.wickDownColor": wickDown,
    "mainSeriesProperties.barStyle.upColor": style.bar.up,
    "mainSeriesProperties.barStyle.downColor": style.bar.down,
    "mainSeriesProperties.lineStyle.color": style.line,
    "paneProperties.background": withAlpha(style.background, style.backgroundOpacity),
    "paneProperties.backgroundType": "solid",
  };
}

// --- Indicators -> widget studies -------------------------------------------

// TradingView built-in study ids. The free widget accepts this array; per-study
// *inputs* (e.g. SMA length) are a Charting Library feature via
// `studies_overrides` and are not reliably honoured here, so tile indicators on
// TradingView tiles are on/off only. Native tiles remain the route to fully
// parameterised indicators.
const STUDY_IDS = {
  sma: "MASimple@tv-basicstudies",
  ema: "MAExp@tv-basicstudies",
  vwap: "VWAP@tv-basicstudies",
  bollinger: "BB@tv-basicstudies",
  rsi: "RSI@tv-basicstudies",
  volume: "Volume@tv-basicstudies",
} as const;

/** The subset of our indicator config TradingView tiles can express. */
export const TV_SUPPORTED_INDICATORS = [
  "sma",
  "ema",
  "vwap",
  "bollinger",
  "rsi",
  "volume",
] as const;

export function tvStudies(indicators: IndicatorState): string[] {
  const out: string[] = [];
  for (const id of TV_SUPPORTED_INDICATORS) {
    const cfg = indicators[id as keyof IndicatorState] as { enabled?: boolean } | undefined;
    if (cfg?.enabled) out.push(STUDY_IDS[id]);
  }
  return out;
}
