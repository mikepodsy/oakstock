"use client";

import { ChevronLeft, RefreshCw } from "lucide-react";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { TechnicalRatingResult } from "@/hooks/useTechnicalRating";
import {
  voteColor,
  voteLabel,
  type IndicatorReading,
  type RatingCounts,
} from "@/utils/technicalRating";
import { RatingGauge } from "./RatingGauge";

interface TechnicalsDetailProps extends TechnicalRatingResult {
  ticker: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  onBack: () => void;
}

function CountsRow({ counts }: { counts: RatingCounts }) {
  return (
    <div className="mt-4 grid w-full max-w-[300px] grid-cols-3 gap-2 text-center">
      {(
        [
          ["Sell", counts.sell, "var(--red-primary)"],
          ["Neutral", counts.neutral, "var(--text-tertiary)"],
          ["Buy", counts.buy, "var(--green-primary)"],
        ] as const
      ).map(([label, value, color]) => (
        <div key={label}>
          <div className="whitespace-nowrap text-xs text-text-tertiary">
            {label}
          </div>
          <div className="font-financial text-xl" style={{ color }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function IndicatorTable({
  title,
  readings,
}: {
  title: string;
  readings: IndicatorReading[];
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">{title}</h3>

      {/* Scrolls on its own if the column gets tight, so the page never does. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-border-primary text-xs text-text-tertiary">
              <th className="py-2 pr-4 text-left font-normal">Name</th>
              <th className="py-2 pr-4 text-right font-normal whitespace-nowrap">
                Value
              </th>
              <th className="py-2 text-right font-normal whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr
                key={r.name}
                className="border-b border-border-secondary last:border-0"
              >
                <td className="py-2.5 pr-4 text-text-secondary">{r.name}</td>
                <td className="py-2.5 pr-4 text-right font-financial tabular-nums whitespace-nowrap text-text-primary">
                  {r.value == null ? "—" : r.value.toFixed(2)}
                </td>
                <td
                  className="py-2.5 text-right font-medium whitespace-nowrap"
                  style={{
                    color: r.vote ? voteColor(r.vote) : "var(--text-tertiary)",
                  }}
                >
                  {r.vote ? voteLabel(r.vote) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The "More technicals" view. Replaces the chart pane rather than opening a
 * dialog, so the symbol list stays put and "Back to chart" is a single click.
 *
 * The timeframe row drives the scanner's shared interval, so the chart behind
 * this view, the panel gauge, and these tables can never disagree.
 */
export function TechnicalsDetail({
  ticker,
  interval,
  rating,
  loading,
  reason,
  retry,
  onIntervalChange,
  onBack,
}: TechnicalsDetailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
        <h2 className="flex items-center gap-2.5 font-display text-xl text-text-primary">
          <CompanyLogo
            ticker={ticker}
            className="h-7 w-7 rounded-md"
            textClassName="text-[10px]"
          />
          <span className="font-financial">{ticker}</span>
          <span className="text-text-tertiary">· Technicals</span>
        </h2>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-tertiary px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to chart
        </button>
      </div>

      <div className="mb-5 flex shrink-0 flex-wrap items-center gap-2">
        {QUESTRADE_INTERVALS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onIntervalChange(opt.value)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              opt.value === interval
                ? "bg-green-primary text-bg-primary"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : !rating ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary py-16 text-center">
            <p className="text-sm text-text-secondary">
              {reason === "fetch"
                ? `Couldn't load candle data for ${ticker} at this interval.`
                : `Not enough price history for ${ticker} at this interval.`}
            </p>
            {reason === "fetch" && (
              <button
                onClick={retry}
                className="mt-4 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-tertiary px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 rounded-xl border border-border-primary bg-bg-secondary p-6 md:grid-cols-3 md:gap-8">
              <div className="flex flex-col items-center">
                <RatingGauge
                  title="Oscillators"
                  size="lg"
                  score={rating.oscillators.score}
                  rating={rating.oscillators.rating}
                />
                <CountsRow counts={rating.oscillators.counts} />
              </div>
              <div className="flex flex-col items-center">
                <RatingGauge
                  title="Summary"
                  size="lg"
                  score={rating.summary.score}
                  rating={rating.summary.rating}
                />
                <CountsRow counts={rating.summary.counts} />
              </div>
              <div className="flex flex-col items-center">
                <RatingGauge
                  title="Moving Averages"
                  size="lg"
                  score={rating.movingAverages.score}
                  rating={rating.movingAverages.rating}
                />
                <CountsRow counts={rating.movingAverages.counts} />
              </div>
            </div>

            <div className="mt-6 grid gap-6 pb-2 lg:grid-cols-2">
              <IndicatorTable
                title="Oscillators"
                readings={rating.oscillators.readings}
              />
              <IndicatorTable
                title="Moving Averages"
                readings={rating.movingAverages.readings}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
