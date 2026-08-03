"use client";

// A TradingView Advanced Chart embed. Used for everything the Questrade candle
// API can't serve — index futures, treasuries, metals, energy, FX — since
// TradingView supplies the market data for these.
//
// The widget renders inside an iframe, so it can't be updated in place: any
// config change means tearing the container down and re-injecting the script.
// That's cheap on a symbol/interval change but must never happen mid-drag, so
// the grid commits geometry only on drag/resize *stop* and `autosize` handles
// the in-between.

import { useEffect, useMemo, useRef } from "react";
import { useThemeStore } from "@/stores/themeStore";
import type { ChartTile } from "@/stores/dashboardLayoutStore";
import { tvChartStyle, tvOverrides, tvStudies } from "@/utils/tvSymbols";

const WIDGET_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export function TradingViewTile({ tile }: { tile: ChartTile }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);

  // Serialized so the effect re-runs on a genuine config change rather than on
  // every re-render (style/indicators are fresh object identities each edit).
  const config = useMemo(
    () =>
      JSON.stringify({
        symbol: tile.symbol,
        interval: tile.interval,
        theme: theme === "light" ? "light" : "dark",
        style: tvChartStyle(tile.chartType),
        autosize: true,
        timezone: "America/New_York",
        locale: "en",
        // The tile header already owns symbol + interval, so the widget's own
        // pickers would be a confusing second source of truth.
        allow_symbol_change: false,
        hide_top_toolbar: false,
        hide_side_toolbar: true,
        hide_legend: false,
        save_image: false,
        studies: tvStudies(tile.indicators),
        overrides: tvOverrides(tile.style),
        support_host: "https://www.tradingview.com",
      }),
    [tile.symbol, tile.interval, tile.chartType, tile.style, tile.indicators, theme]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = config;

    host.appendChild(widget);
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [config]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="tradingview-widget-container min-h-0 flex-1" />
      {/* Attribution link — required by TradingView's widget terms. */}
      <a
        href={`https://www.tradingview.com/symbols/${encodeURIComponent(tile.symbol)}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 px-1 pt-1 text-[10px] text-text-tertiary hover:text-text-secondary"
      >
        Chart by TradingView
      </a>
    </div>
  );
}
