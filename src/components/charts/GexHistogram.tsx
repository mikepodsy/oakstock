"use client";

import { useEffect, useRef } from "react";
import type { ISeriesApi, SeriesType } from "lightweight-charts";
import type { OptionStrikeRow } from "@/types";

const POS_COLOR = "#22C55E"; // dealers long gamma (stabilizing)
const NEG_COLOR = "#EF4444"; // dealers short gamma (accelerant)
const ZERO_LINE = "rgba(148,163,184,0.35)";
const FLIP_COLOR = "#FBBF24"; // the zero-gamma flip — the key level

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
  epoch: number;
  className?: string;
}

/**
 * Diverging gamma-exposure histogram aligned to the chart's price axis. Each
 * strike's net GEX draws from a center zero line — green right (dealers long
 * gamma), red left (short gamma) — and a dashed line marks the zero-gamma flip.
 * Coordinates come from `series.priceToCoordinate` so it tracks the price scale.
 */
export function GexHistogram({
  series,
  rows,
  flip,
  netGex,
  epoch,
  className,
}: GexHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !series) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastSig = "";

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) {
        raf = requestAnimationFrame(paint);
        return;
      }

      const placed: Array<{ y: number; gex: number }> = [];
      for (const r of rows) {
        if (r.gex === 0) continue;
        const y = series.priceToCoordinate(r.strike);
        if (y === null) continue;
        placed.push({ y, gex: r.gex });
      }
      const flipY = flip != null ? series.priceToCoordinate(flip) : null;

      const sig =
        `${cssW}x${cssH}x${dpr}|${flipY}|` +
        placed.map((p) => `${Math.round(p.y)}:${p.gex.toFixed(0)}`).join(",");
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

      // Center zero line.
      ctx.strokeStyle = ZERO_LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, cssH);
      ctx.stroke();

      if (placed.length > 0) {
        const maxAbs = Math.max(1, ...placed.map((p) => Math.abs(p.gex)));
        const halfW = cx - 3;

        const ys = placed.map((p) => p.y).sort((a, b) => a - b);
        let gap = cssH;
        for (let i = 1; i < ys.length; i++) gap = Math.min(gap, ys[i] - ys[i - 1]);
        const barH = Math.max(1.5, Math.min(gap * 0.7, 10));

        for (const p of placed) {
          const len = (Math.abs(p.gex) / maxAbs) * halfW;
          const top = p.y - barH / 2;
          if (p.gex >= 0) {
            ctx.fillStyle = POS_COLOR;
            ctx.fillRect(cx, top, len, barH);
          } else {
            ctx.fillStyle = NEG_COLOR;
            ctx.fillRect(cx - len, top, len, barH);
          }
        }
      }

      // Zero-gamma flip line + price label.
      if (flipY !== null && flipY >= 0 && flipY <= cssH) {
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
        ctx.textBaseline = "bottom";
        ctx.fillText(`flip ${flip!.toFixed(2)}`, 2, Math.round(flipY) - 1);
      }

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [series, rows, flip, epoch]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Net-GEX readout. Green = dealers net long gamma (stabilizing). */}
      <div className="absolute top-1 left-1 rounded bg-bg-elevated/70 px-1.5 py-0.5 backdrop-blur">
        <div className="text-[9px] uppercase tracking-wide text-text-tertiary">
          Net GEX
        </div>
        <div
          className="text-[11px] font-semibold"
          style={{ color: netGex >= 0 ? POS_COLOR : NEG_COLOR }}
        >
          {formatGexShort(netGex)}
        </div>
      </div>
    </div>
  );
}
