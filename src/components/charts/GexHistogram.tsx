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
import { formatCompactNumber } from "@/utils/formatters";
import { niceTicks } from "@/utils/ticks";
import { findHoveredStrike } from "@/utils/strikeHover";
import { StrikeTooltip } from "./StrikeTooltip";

const POS_COLOR = "#22C55E"; // dealers long gamma (stabilizing)
const NEG_COLOR = "#EF4444"; // dealers short gamma (accelerant)
const ZERO_LINE = "rgba(148,163,184,0.35)";
const FLIP_COLOR = "#FBBF24"; // the zero-gamma flip — the key level
const SPOT_COLOR = "rgba(226,232,240,0.85)"; // current spot price line
const AXIS_COLOR = "rgba(148,163,184,0.7)";
const HOVER_BAND = "rgba(148,163,184,0.16)"; // row highlight under the cursor
const HOVER_LINE = "rgba(226,232,240,0.55)";
const AXIS_H = 16; // bottom strip reserved for the value axis labels

/** A bar's price level plus the values behind it, kept for hit-testing. */
interface PlacedBar {
  y: number;
  strike: number;
  gex: number;
  call: number;
  put: number;
}

// Compact dollar formatting for the net-GEX readout, e.g. +$6.9M / -$1.2B.
function formatGexShort(n: number): string {
  const sign = n < 0 ? "-" : "+";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

interface GexHistogramProps {
  series: ISeriesApi<SeriesType> | null;
  rows: OptionStrikeRow[];
  /** Approximate zero-gamma flip price, or null when it never crosses. */
  flip: number | null;
  /** Total net GEX across the window (dollars per 1% move). */
  netGex: number;
  /** Current underlying price, drawn as a dashed line across the panel. */
  spot: number | null;
  /** "net" = signed diverging bars; "split" = call left / put right. */
  view: StrikeView;
  epoch: number;
  className?: string;
}

/**
 * Diverging gamma-exposure histogram aligned to the chart's price axis. Each
 * strike's net GEX draws from a center zero line — green left (dealers long
 * gamma), red right (short gamma) — with a fixed value axis along the bottom,
 * a dashed line at the zero-gamma flip, and a dashed line at the spot price.
 */
export function GexHistogram({
  series,
  rows,
  flip,
  netGex,
  spot,
  view,
  epoch,
  className,
}: GexHistogramProps) {
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
    const split = view === "split";

    // Fixed scale across all strikes (not just visible) → stable axis. In split
    // mode each side is scaled independently of sign.
    const maxAbs = split
      ? Math.max(1, ...rows.map((r) => Math.max(r.callGex, r.putGex)))
      : Math.max(1, ...rows.map((r) => Math.abs(r.gex)));

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) {
        raf = requestAnimationFrame(paint);
        return;
      }
      const plotH = cssH - AXIS_H;

      const placed: PlacedBar[] = [];
      for (const r of rows) {
        if (split ? r.callGex === 0 && r.putGex === 0 : r.gex === 0) continue;
        const y = series.priceToCoordinate(r.strike);
        if (y === null || y > plotH) continue;
        placed.push({
          y,
          strike: r.strike,
          gex: r.gex,
          call: r.callGex,
          put: r.putGex,
        });
      }
      placedRef.current = placed;
      const flipY = flip != null ? series.priceToCoordinate(flip) : null;
      const spotY = spot != null ? series.priceToCoordinate(spot) : null;
      // Re-resolve the hovered strike's y each frame so the highlight tracks
      // zoom, pan and data refreshes instead of sticking where it was drawn.
      const hoveredStrike = hoverRef.current;
      const hoveredY =
        hoveredStrike === null
          ? null
          : placed.find((p) => p.strike === hoveredStrike)?.y ?? null;

      const sig =
        `${cssW}x${cssH}x${dpr}|${view}|${maxAbs}|${flipY}|${spotY}|${hoveredY}|` +
        placed
          .map((p) =>
            split
              ? `${Math.round(p.y)}:${p.call.toFixed(0)}:${p.put.toFixed(0)}`
              : `${Math.round(p.y)}:${p.gex.toFixed(0)}`
          )
          .join(",");
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

      const cx = Math.round(cssW / 2);
      const halfW = cx - 3;

      // Bar thickness: the tightest strike spacing, clamped so sparse windows
      // don't grow slabs and dense ones stay readable.
      let barH = 6;
      if (placed.length > 0) {
        const ys = placed.map((q) => q.y).sort((a, b) => a - b);
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

      // Center zero line.
      ctx.strokeStyle = ZERO_LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, plotH);
      ctx.stroke();

      // Bars. Net mode: positive (long gamma) grows left, negative grows right.
      // Split mode: call GEX grows left (green), put GEX grows right (red).
      if (placed.length > 0) {
        for (const p of placed) {
          if (split) {
            const callLen = (p.call / maxAbs) * halfW;
            const putLen = (p.put / maxAbs) * halfW;
            if (callLen > 0) {
              ctx.fillStyle = POS_COLOR;
              ctx.fillRect(cx - callLen, p.y - barH / 2, callLen, barH);
            }
            if (putLen > 0) {
              ctx.fillStyle = NEG_COLOR;
              ctx.fillRect(cx, p.y - barH / 2, putLen, barH);
            }
          } else {
            const len = (Math.abs(p.gex) / maxAbs) * halfW;
            if (p.gex >= 0) {
              ctx.fillStyle = POS_COLOR;
              ctx.fillRect(cx - len, p.y - barH / 2, len, barH);
            } else {
              ctx.fillStyle = NEG_COLOR;
              ctx.fillRect(cx, p.y - barH / 2, len, barH);
            }
          }
        }
      }

      // Zero-gamma flip line + price label.
      if (flipY !== null && flipY >= 0 && flipY <= plotH) {
        ctx.strokeStyle = FLIP_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(flipY) + 0.5);
        ctx.lineTo(cssW, Math.round(flipY) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = FLIP_COLOR;
        ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`flip ${flip!.toFixed(2)}`, 2, Math.round(flipY) - 1);
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

      // Bottom value axis: 0 at center, positive left, negative right.
      ctx.fillStyle = AXIS_COLOR;
      ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.fillText("0", cx, cssH - 2);
      for (const v of niceTicks(maxAbs, 2)) {
        if (v === 0) continue;
        const dx = (v / maxAbs) * halfW;
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

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [series, rows, flip, spot, view, epoch]);

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

  const totalOI = rows.reduce((s, r) => s + r.callOI + r.putOI, 0);
  const callGexTotal = rows.reduce((s, r) => s + r.callGex, 0);
  const putGexTotal = rows.reduce((s, r) => s + r.putGex, 0);

  const hoveredRow = hover ? rows.find((r) => r.strike === hover.strike) : undefined;

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
              label: "Call GEX",
              value: formatGexShort(hoveredRow.callGex),
              color: POS_COLOR,
            },
            {
              label: "Put GEX",
              value: formatGexShort(hoveredRow.putGex),
              color: NEG_COLOR,
            },
            { label: "Net", value: formatGexShort(hoveredRow.gex) },
            { label: "OI", value: formatCompactNumber(hoveredRow.callOI + hoveredRow.putOI) },
          ]}
        />
      )}
      {/* Title + GEX readout + total OI contracts. */}
      <div className="absolute top-1 left-1 rounded bg-bg-elevated/70 px-1.5 py-0.5 backdrop-blur">
        <div className="text-[10px] font-semibold text-text-primary">GEX</div>
        {view === "split" ? (
          <div className="text-[11px] font-semibold">
            <span style={{ color: POS_COLOR }}>
              {formatGexShort(callGexTotal)} C
            </span>
            <span className="text-text-tertiary"> · </span>
            <span style={{ color: NEG_COLOR }}>
              {formatGexShort(putGexTotal)} P
            </span>
          </div>
        ) : (
          <div
            className="text-[11px] font-semibold"
            style={{ color: netGex >= 0 ? POS_COLOR : NEG_COLOR }}
          >
            {formatGexShort(netGex)}
          </div>
        )}
        <div className="text-[9px] text-text-tertiary">
          OI {formatCompactNumber(totalOI)}
        </div>
      </div>
    </div>
  );
}
