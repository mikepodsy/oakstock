"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { useMarketData } from "@/hooks/useMarketData";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EconomicDataPoint } from "@/types";

// VIXEQ − VIX spread bands. Higher spread = more single-stock dispersion, the
// alarming state → red. Tune these once live values are observed.
const YELLOW_THRESHOLD = 1.0;
const RED_THRESHOLD = 3.0;

type Band = {
  label: string;
  dot: string;
  value: string;
  ring: string;
};

function classify(spread: number): Band {
  if (spread >= RED_THRESHOLD) {
    return {
      label: "Elevated",
      dot: "bg-red-primary",
      value: "text-red-primary",
      ring: "border-red-primary/30 bg-red-primary/10",
    };
  }
  if (spread >= YELLOW_THRESHOLD) {
    return {
      label: "Watch",
      dot: "bg-yellow-500",
      value: "text-yellow-500",
      ring: "border-yellow-500/30 bg-yellow-500/10",
    };
  }
  return {
    label: "Calm",
    dot: "bg-green-primary",
    value: "text-green-primary",
    ring: "border-green-primary/30 bg-green-primary/10",
  };
}

const TIMEFRAMES = [
  { value: "1d", label: "Daily" },
  { value: "1h", label: "Hourly" },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

function SpreadTooltip({
  active,
  payload,
  label,
  timeframe,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  timeframe: Timeframe;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated p-3 shadow-lg">
      <p className="mb-1 text-xs text-text-secondary">
        {format(parseISO(label), timeframe === "1h" ? "MMM d, h:mm a" : "MMM d, yyyy")}
      </p>
      <p className="font-financial text-sm text-text-primary tabular-nums">
        {payload[0].value.toFixed(2)}
      </p>
    </div>
  );
}

function SpreadChart({
  data,
  timeframe,
}: {
  data: EconomicDataPoint[];
  timeframe: Timeframe;
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
          tickFormatter={(date: string) =>
            format(parseISO(date), timeframe === "1h" ? "MMM d, h a" : "MMM d, yy")
          }
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
          tickFormatter={(value: number) => value.toFixed(2)}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<SpreadTooltip timeframe={timeframe} />} />
        {/* Band boundaries, so the line can be read against the card's colour. */}
        <ReferenceLine
          y={YELLOW_THRESHOLD}
          stroke="#EAB308"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <ReferenceLine
          y={RED_THRESHOLD}
          stroke="var(--red-primary)"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--green-primary)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartFrame({
  data,
  loading,
  timeframe,
}: {
  data: EconomicDataPoint[];
  loading: boolean;
  timeframe: Timeframe;
}) {
  if (loading && data.length === 0) {
    return <Skeleton className="h-[340px] w-full rounded-lg" />;
  }
  if (data.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center">
        <p className="text-sm text-text-secondary">No history available</p>
      </div>
    );
  }
  return <SpreadChart data={data} timeframe={timeframe} />;
}

/**
 * Hourly view. Kept in its own component so the request only fires when the
 * timeframe is actually selected, rather than on every card render.
 */
function HourlyChart() {
  const { data, loading } = useMarketData("vixeqVix", "5y", "1h");
  return (
    <ChartFrame data={data?.data ?? []} loading={loading} timeframe="1h" />
  );
}

export function DispersionCard() {
  // Daily closes, rolled up server-side from the hourly bars that are the only
  // source ^VIXEQ has. Goes back as far as Yahoo serves them (~2 years).
  const { data, loading } = useMarketData("vixeqVix", "5y");
  const [open, setOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const spread = data?.currentValue ?? null;
  const change = data?.change ?? null;
  const history = data?.data ?? [];

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
    );
  }

  const band = spread !== null ? classify(spread) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          "w-full rounded-xl border p-5 text-left transition-colors hover:brightness-110",
          band ? band.ring : "border-border-primary bg-bg-secondary"
        )}
      >
        <div className="flex items-center gap-2">
          {band && <span className={cn("h-2 w-2 rounded-full", band.dot)} />}
          <h3 className="font-display text-sm text-text-primary">
            VIXEQ − VIX · Dispersion
          </h3>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={cn(
              "font-financial text-3xl tabular-nums",
              band ? band.value : "text-text-primary"
            )}
          >
            {spread !== null ? spread.toFixed(2) : "—"}
          </span>
          {band && (
            <span className="text-sm font-medium text-text-secondary">
              {band.label}
            </span>
          )}
        </div>
        {change !== null && (
          <p className="mt-1 text-xs text-text-tertiary tabular-nums">
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} since prior close
          </p>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between pr-10">
          <DialogTitle>VIXEQ − VIX · Dispersion</DialogTitle>
          <div className="flex gap-0.5 rounded-lg bg-bg-tertiary p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeframe(t.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  timeframe === t.value
                    ? "bg-bg-secondary text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </DialogHeader>
        {timeframe === "1h" ? (
          <HourlyChart />
        ) : (
          <ChartFrame data={history} loading={loading} timeframe="1d" />
        )}
      </DialogContent>
    </Dialog>
  );
}
