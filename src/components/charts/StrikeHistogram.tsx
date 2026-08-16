"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ISeriesApi, SeriesType } from "lightweight-charts";
import type { OptionStrikeRow, StrikeView } from "@/types";
import {
  formatCompactNumber,
  formatContracts,
  formatSignedContracts,
} from "@/utils/formatters";
import { niceTicks } from "@/utils/ticks";
import { findHoveredStrike } from "@/utils/strikeHover";
import { StrikeTooltip } from "./StrikeTooltip";

// Calls/puts colors, matching the green-up / red-down convention used for the
// volume bars elsewhere in the chart.
const CALL_COLOR = "#22C55E";
const PUT_COLOR = "#EF4444";
const ZERO_LINE = "rgba(148,163,184,0.35)";
const AXIS_COLOR = "rgba(148,163,184,0.7)";
const SPOT_COLOR = "rgba(226,232,240,0.85)"; // current spot price line
const HOVER_BAND = "rgba(148,163,184,0.16)"; // row highlight under the cursor
const HOVER_LINE = "rgba(226,232,240,0.55)";
const AXIS_H = 16; // bottom strip reserved for the value axis labels

/** A bar's price level plus the values behind it, kept for hit-testing. */
interface PlacedBar {
  y: number;
  strike: number;
  call: number;
  put: number;
}

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
  // Latest painted geometry, read by the pointer handler to hit-test rows.
  const placedRef = useRef<PlacedBar[]>([]);
  const barHRef = useRef(6);
  const hoverRef = useRef<number | null>(null); // hovered strike price
  const [hover, setHover] = useState<{
    strike: number;
    x: number;
    y: number;
    panelW: number;
    panelH: number;
  } | null>(null);

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

      const placed: PlacedBar[] = [];
      for (const r of rows) {
        const y = series.priceToCoordinate(r.strike);
        if (y === null || y > plotH) continue;
        placed.push({ y, strike: r.strike, call: callOf(r), put: putOf(r) });
      }
      placedRef.current = placed;
      const spotY = spot != null ? series.priceToCoordinate(spot) : null;
      // Re-resolve the hovered strike's y each frame so the highlight tracks
      // zoom, pan and data refreshes instead of sticking where it was drawn.
      const hoveredStrike = hoverRef.current;
      const hoveredY =
        hoveredStrike === null
          ? null
          : placed.find((p) => p.strike === hoveredStrike)?.y ?? null;

      const sig =
        `${cssW}x${cssH}x${dpr}|${metric}|${view}|${maxTotal}|${spotY}|${hoveredY}|` +
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

      // Bar thickness: the tightest strike spacing, clamped so sparse windows
      // don't grow slabs and dense ones stay readable.
      let barH = 6;
      if (placed.length > 0) {
        const ys = placed.map((p) => p.y).sort((a, b) => a - b);
        let gap = plotH;
        for (let i = 1; i < ys.length; i++) gap = Math.min(gap, ys[i] - ys[i - 1]);
        barH = Math.max(1.5, Math.min(gap * 0.7, 10));
      }
      barHRef.current = barH;

      // Hovered row: a highlight band across the panel so the price level under
      // the cursor is unmistakable.
      if (hoveredY !== null && hoveredY <= plotH) {
        const bandH = Math.max(barH + 4, 9);
        ctx.fillStyle = HOVER_BAND;
        ctx.fillRect(0, hoveredY - bandH / 2, cssW, bandH);
        ctx.strokeStyle = HOVER_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(hoveredY) + 0.5);
        ctx.lineTo(cssW, Math.round(hoveredY) + 0.5);
        ctx.stroke();
      }

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

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Rows sit close together, so hit-test on y alone within half a bar's
    // reach — anywhere on a strike's row counts as hovering it.
    const tolerance = Math.max(barHRef.current / 2 + 3, 6);
    const bar =
      y <= rect.height - AXIS_H
        ? findHoveredStrike(placedRef.current, y, tolerance)
        : null;

    hoverRef.current = bar?.strike ?? null;
    setHover(
      bar
        ? {
            strike: bar.strike,
            x,
            y: bar.y,
            panelW: rect.width,
            panelH: rect.height,
          }
        : null
    );
  }, []);

  const handlePointerLeave = useCallback(() => {
    hoverRef.current = null;
    setHover(null);
  }, []);

  const callTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.callOI : r.callVol),
    0
  );
  const putTotal = rows.reduce(
    (s, r) => s + (metric === "oi" ? r.putOI : r.putVol),
    0
  );

  const label = metric === "oi" ? "OI" : "Vol";
  const hoveredRow = hover ? rows.find((r) => r.strike === hover.strike) : undefined;
  const hoveredCall = hoveredRow
    ? metric === "oi"
      ? hoveredRow.callOI
      : hoveredRow.callVol
    : 0;
  const hoveredPut = hoveredRow
    ? metric === "oi"
      ? hoveredRow.putOI
      : hoveredRow.putVol
    : 0;

  return (
    <div
      className={`relative ${className ?? ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {hover && hoveredRow && (
        <StrikeTooltip
          strike={hover.strike}
          x={hover.x}
          y={hover.y}
          panelW={hover.panelW}
          panelH={hover.panelH}
          rows={[
            {
              label: `Call ${label}`,
              value: formatContracts(hoveredCall),
              color: CALL_COLOR,
            },
            {
              label: `Put ${label}`,
              value: formatContracts(hoveredPut),
              color: PUT_COLOR,
            },
            view === "net"
              ? {
                  label: "Net",
                  value: formatSignedContracts(hoveredCall - hoveredPut),
                }
              : {
                  label: "Total",
                  value: formatContracts(hoveredCall + hoveredPut),
                },
          ]}
        />
      )}
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
