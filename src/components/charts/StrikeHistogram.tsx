"use client";

import { useEffect, useRef } from "react";
import type { ISeriesApi, SeriesType } from "lightweight-charts";
import type { OptionStrikeRow } from "@/types";
import { formatCompactNumber } from "@/utils/formatters";

// Calls/puts colors, matching the green-up / red-down convention used for the
// volume bars elsewhere in the chart.
const CALL_COLOR = "#22C55E";
const PUT_COLOR = "#EF4444";

interface StrikeHistogramProps {
  /** The candle series — used to map a strike price to a y pixel coordinate. */
  series: ISeriesApi<SeriesType> | null;
  rows: OptionStrikeRow[];
  metric: "oi" | "volume";
  /** Bumped by the parent when the chart is recreated, to re-bind the canvas. */
  epoch: number;
  className?: string;
}

/**
 * A price-axis-aligned histogram drawn beside the chart. Each strike's bar sits
 * at the same y the chart maps that price to, so the bars line up with the
 * candles' price scale and stay aligned through zoom/pan/autoscale.
 *
 * It reads `series.priceToCoordinate` every animation frame and repaints only
 * when the mapping actually changes — cheap, and immune to which lightweight
 * event fired. Calls and puts stack into a single bar (call segment first),
 * scaled so the largest visible strike fills the panel width.
 */
export function StrikeHistogram({
  series,
  rows,
  metric,
  epoch,
  className,
}: StrikeHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastSig = "";

    const callOf = (r: OptionStrikeRow) => (metric === "oi" ? r.callOI : r.callVol);
    const putOf = (r: OptionStrikeRow) => (metric === "oi" ? r.putOI : r.putVol);

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) {
        raf = requestAnimationFrame(paint);
        return;
      }

      // Resolve each strike to a y coordinate; drop strikes off the visible range.
      const placed: Array<{ y: number; call: number; put: number }> = [];
      for (const r of rows) {
        const y = series.priceToCoordinate(r.strike);
        if (y === null) continue;
        placed.push({ y, call: callOf(r), put: putOf(r) });
      }

      // Skip repaint when nothing visible changed (coordinates + size + data).
      const sig =
        `${cssW}x${cssH}x${dpr}|${metric}|` +
        placed.map((p) => `${Math.round(p.y)}:${p.call}:${p.put}`).join(",");
      if (sig === lastSig) {
        raf = requestAnimationFrame(paint);
        return;
      }
      lastSig = sig;

      // Size the backing store for crisp lines on HiDPI.
      const wantW = Math.round(cssW * dpr);
      const wantH = Math.round(cssH * dpr);
      if (canvas.width !== wantW) canvas.width = wantW;
      if (canvas.height !== wantH) canvas.height = wantH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (placed.length > 0) {
        // Scale so the largest combined (call+put) strike fills the width, with a
        // little padding on the right.
        const maxTotal = Math.max(
          1,
          ...placed.map((p) => p.call + p.put)
        );
        const usableW = cssW - 4;

        // Bar thickness from the median gap between adjacent strikes.
        const ys = placed.map((p) => p.y).sort((a, b) => a - b);
        let gap = cssH;
        for (let i = 1; i < ys.length; i++) gap = Math.min(gap, ys[i] - ys[i - 1]);
        const barH = Math.max(1.5, Math.min(gap * 0.7, 10));

        for (const p of placed) {
          const callW = (p.call / maxTotal) * usableW;
          const putW = (p.put / maxTotal) * usableW;
          const top = p.y - barH / 2;
          // Calls grow from the left edge (nearest the price axis), puts continue.
          if (callW > 0) {
            ctx.fillStyle = CALL_COLOR;
            ctx.fillRect(0, top, callW, barH);
          }
          if (putW > 0) {
            ctx.fillStyle = PUT_COLOR;
            ctx.fillRect(callW, top, putW, barH);
          }
        }
      }

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [series, rows, metric, epoch]);

  const callTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.callOI : r.callVol),
    0
  );
  const putTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.putOI : r.putVol),
    0
  );
  const label = metric === "oi" ? "OI" : "Vol";

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Total contracts for the active metric, overlaid on the empty axis
          region at the bottom so the canvas stays full-height + price-aligned. */}
      <div className="absolute inset-x-1 bottom-1 rounded bg-bg-elevated/70 px-1.5 py-0.5 backdrop-blur">
        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-wide text-text-tertiary">
            {label} contracts
          </span>
          <span className="font-semibold text-text-primary">
            {formatCompactNumber(callTotal + putTotal)}
          </span>
        </div>
        <div className="text-[9px]">
          <span style={{ color: CALL_COLOR }}>
            {formatCompactNumber(callTotal)} C
          </span>
          <span className="text-text-tertiary"> · </span>
          <span style={{ color: PUT_COLOR }}>
            {formatCompactNumber(putTotal)} P
          </span>
        </div>
      </div>
    </div>
  );
}
