"use client";

import { useEffect, useRef } from "react";
import type { ISeriesApi, SeriesType } from "lightweight-charts";
import type { OptionStrikeRow, StrikeView } from "@/types";
import { formatCompactNumber } from "@/utils/formatters";
import { niceTicks } from "@/utils/ticks";

// Calls/puts colors, matching the green-up / red-down convention used for the
// volume bars elsewhere in the chart.
const CALL_COLOR = "#22C55E";
const PUT_COLOR = "#EF4444";
const ZERO_LINE = "rgba(148,163,184,0.35)";
const AXIS_COLOR = "rgba(148,163,184,0.7)";
const SPOT_COLOR = "rgba(226,232,240,0.85)"; // current spot price line
const AXIS_H = 16; // bottom strip reserved for the value axis labels

interface StrikeHistogramProps {
  /** The candle series — used to map a strike price to a y pixel coordinate. */
  series: ISeriesApi<SeriesType> | null;
  rows: OptionStrikeRow[];
  metric: "oi" | "volume";
  /** "split" = call + put segments; "net" = signed call−put diverging bars. */
  view: StrikeView;
  /** Current underlying price, drawn as a dashed line across the panel. */
  spot: number | null;
  /** Bumped by the parent when the chart is recreated, to re-bind the canvas. */
  epoch: number;
  className?: string;
}

/**
 * A price-axis-aligned histogram drawn beside the chart. Each strike's bar sits
 * at the same y the chart maps that price to, so the bars line up with the
 * candles' price scale and stay aligned through zoom/pan/autoscale.
 *
 * Calls and puts stack into a single bar (call segment first), scaled to a fixed
 * max across all strikes so the bottom value axis stays stable while zooming. A
 * dashed line marks the current spot price.
 */
export function StrikeHistogram({
  series,
  rows,
  metric,
  view,
  spot,
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
    const net = view === "net";

    const callOf = (r: OptionStrikeRow) => (metric === "oi" ? r.callOI : r.callVol);
    const putOf = (r: OptionStrikeRow) => (metric === "oi" ? r.putOI : r.putVol);

    // Fixed scale across all strikes (not just visible) → stable axis. Net mode
    // scales by the largest call−put imbalance; split mode by the largest total.
    const maxTotal = net
      ? Math.max(1, ...rows.map((r) => Math.abs(callOf(r) - putOf(r))))
      : Math.max(1, ...rows.map((r) => callOf(r) + putOf(r)));

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) {
        raf = requestAnimationFrame(paint);
        return;
      }
      const plotH = cssH - AXIS_H; // keep bars out of the axis strip

      const placed: Array<{ y: number; call: number; put: number }> = [];
      for (const r of rows) {
        const y = series.priceToCoordinate(r.strike);
        if (y === null || y > plotH) continue;
        placed.push({ y, call: callOf(r), put: putOf(r) });
      }
      const spotY = spot != null ? series.priceToCoordinate(spot) : null;

      const sig =
        `${cssW}x${cssH}x${dpr}|${metric}|${view}|${maxTotal}|${spotY}|` +
        placed.map((p) => `${Math.round(p.y)}:${p.call}:${p.put}`).join(",");
      if (sig === lastSig) {
        raf = requestAnimationFrame(paint);
        return;
      }
      lastSig = sig;

      const wantW = Math.round(cssW * dpr);
      const wantH = Math.round(cssH * dpr);
      if (canvas.width !== wantW) canvas.width = wantW;
      if (canvas.height !== wantH) canvas.height = wantH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const usableW = cssW - 4; // split: bars grow rightward from the left edge
      const cx = Math.round(cssW / 2); // net: center zero line
      const halfW = cx - 3;

      // Net mode: center zero line (call-heavy left, put-heavy right).
      if (net) {
        ctx.strokeStyle = ZERO_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 0.5, 0);
        ctx.lineTo(cx + 0.5, plotH);
        ctx.stroke();
      }

      // Bars.
      if (placed.length > 0) {
        const ys = placed.map((p) => p.y).sort((a, b) => a - b);
        let gap = plotH;
        for (let i = 1; i < ys.length; i++) gap = Math.min(gap, ys[i] - ys[i - 1]);
        const barH = Math.max(1.5, Math.min(gap * 0.7, 10));

        for (const p of placed) {
          const top = p.y - barH / 2;
          if (net) {
            // call-heavy grows left (green), put-heavy grows right (red).
            const diff = p.call - p.put;
            const len = (Math.abs(diff) / maxTotal) * halfW;
            if (len > 0) {
              ctx.fillStyle = diff >= 0 ? CALL_COLOR : PUT_COLOR;
              ctx.fillRect(diff >= 0 ? cx - len : cx, top, len, barH);
            }
          } else {
            const callW = (p.call / maxTotal) * usableW;
            const putW = (p.put / maxTotal) * usableW;
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
      }

      // Current spot price line.
      if (spotY !== null && spotY >= 0 && spotY <= plotH) {
        ctx.strokeStyle = SPOT_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(spotY) + 0.5);
        ctx.lineTo(cssW, Math.round(spotY) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Bottom value axis.
      ctx.fillStyle = AXIS_COLOR;
      ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "bottom";
      if (net) {
        // 0 at center, magnitude growing left (calls) and right (puts).
        ctx.textAlign = "center";
        ctx.fillText("0", cx, cssH - 2);
        for (const v of niceTicks(maxTotal, 2)) {
          if (v === 0) continue;
          const dx = (v / maxTotal) * halfW;
          const label = formatCompactNumber(v);
          if (cx - dx > 10) {
            ctx.textAlign = cx - dx < 14 ? "left" : "center";
            ctx.fillText(label, Math.max(cx - dx, 1), cssH - 2);
          }
          if (cx + dx < cssW - 10) {
            ctx.textAlign = cx + dx > cssW - 14 ? "right" : "center";
            ctx.fillText(label, Math.min(cx + dx, cssW - 1), cssH - 2);
          }
        }
      } else {
        // 0 at the left edge, increasing to the right.
        for (const v of niceTicks(maxTotal, 4)) {
          const x = (v / maxTotal) * usableW;
          ctx.textAlign = v === 0 ? "left" : x > cssW - 14 ? "right" : "center";
          ctx.fillText(formatCompactNumber(v), Math.min(x, cssW - 1), cssH - 2);
        }
      }

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [series, rows, metric, view, spot, epoch]);

  const callTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.callOI : r.callVol),
    0
  );
  const putTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.putOI : r.putVol),
    0
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Title + total contracts for the active metric. */}
      <div className="absolute top-1 left-1 rounded bg-bg-elevated/70 px-1.5 py-0.5 backdrop-blur">
        <div className="text-[10px] font-semibold text-text-primary">
          Options Contracts
        </div>
        <div className="text-[9px]">
          <span className="text-text-tertiary">
            {metric === "oi" ? "OI" : "Vol"}{" "}
          </span>
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
