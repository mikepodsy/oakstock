"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PayoffResult } from "@/types/options";
import { formatCurrency } from "@/utils/formatters";

const INTERMEDIATE = [0.25, 0.5, 0.75];

interface PayoffChartProps {
  result: PayoffResult;
  spot: number;
  showToday: boolean;
  showIntermediate: boolean;
  sigma1?: [number, number] | null;
  sigma2?: [number, number] | null;
}

function PayoffTooltip({
  active,
  payload,
  label,
  showToday,
  showIntermediate,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: number;
  showToday: boolean;
  showIntermediate: boolean;
}) {
  if (!active || !payload || label == null) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const rows: Array<[string, number | undefined, string]> = [
    ["At expiry", get("expiry"), "var(--text-primary)"],
  ];
  if (showToday) rows.push(["Today", get("today"), "var(--oak-300)"]);
  if (showIntermediate) {
    for (const f of INTERMEDIATE) {
      rows.push([`${f * 100}% to exp`, get(`t${f}`), "var(--text-tertiary)"]);
    }
  }
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated px-3 py-2 text-xs shadow-lg">
      <p className="text-text-secondary mb-1">${label.toFixed(2)}</p>
      {rows.map(([name, value, color]) =>
        value == null ? null : (
          <div key={name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {name}
            </span>
            <span
              className="font-financial"
              style={{ color: value >= 0 ? "var(--green-primary)" : "var(--red-primary)" }}
            >
              {formatCurrency(value)}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

export function PayoffChart({
  result,
  spot,
  showToday,
  showIntermediate,
  sigma1,
  sigma2,
}: PayoffChartProps) {
  const { points, breakevens } = result;
  const [pinned, setPinned] = useState<number | null>(null);

  // Split gradient: green above zero, red below, with the stop at the y=0 line.
  const gradientOffset = useMemo(() => {
    const ys = points.map((p) => p.expiry);
    const max = Math.max(...ys, 0);
    const min = Math.min(...ys, 0);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [points]);

  return (
    <div className="h-[360px] md:h-[440px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 10, right: 8, left: 8, bottom: 5 }}
          onClick={(e: { activeLabel?: string | number }) => {
            const v = e?.activeLabel;
            if (v != null) setPinned(Number(v));
          }}
        >
          <defs>
            <linearGradient id="payoffSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor="var(--green-primary)" stopOpacity={0.25} />
              <stop offset={gradientOffset} stopColor="var(--green-primary)" stopOpacity={0.05} />
              <stop offset={gradientOffset} stopColor="var(--red-primary)" stopOpacity={0.05} />
              <stop offset={1} stopColor="var(--red-primary)" stopOpacity={0.25} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
          <XAxis
            dataKey="price"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            content={
              <PayoffTooltip showToday={showToday} showIntermediate={showIntermediate} />
            }
          />

          {/* Expected-move bands (drawn under the curves). */}
          {sigma2 && (
            <ReferenceArea
              x1={sigma2[0]}
              x2={sigma2[1]}
              fill="var(--oak-300)"
              fillOpacity={0.05}
            />
          )}
          {sigma1 && (
            <ReferenceArea
              x1={sigma1[0]}
              x2={sigma1[1]}
              fill="var(--oak-300)"
              fillOpacity={0.08}
            />
          )}

          <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeWidth={1} />

          {/* Expiry P&L: split-colored area + crisp line. */}
          <Area
            type="monotone"
            dataKey="expiry"
            stroke="none"
            fill="url(#payoffSplit)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="expiry"
            stroke="var(--text-primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {showToday && (
            <Line
              type="monotone"
              dataKey="today"
              stroke="var(--oak-300)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          )}

          {showIntermediate &&
            INTERMEDIATE.map((f) => (
              <Line
                key={f}
                type="monotone"
                dataKey={`t${f}`}
                stroke="var(--text-tertiary)"
                strokeOpacity={0.5}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            ))}

          {/* Current spot. */}
          <ReferenceLine
            x={spot}
            stroke="var(--text-secondary)"
            strokeDasharray="2 3"
            label={{ value: "Spot", position: "top", fill: "var(--text-secondary)", fontSize: 11 }}
          />

          {/* Pinned price. */}
          {pinned != null && (
            <ReferenceLine x={pinned} stroke="var(--green-primary)" strokeWidth={1} />
          )}

          {/* Breakeven markers on the zero line. */}
          {breakevens.map((b) => (
            <ReferenceDot
              key={b}
              x={b}
              y={0}
              r={4}
              fill="var(--green-primary)"
              stroke="var(--bg-primary)"
              strokeWidth={1.5}
              label={{
                value: `$${b.toFixed(2)}`,
                position: "bottom",
                fill: "var(--text-secondary)",
                fontSize: 11,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
