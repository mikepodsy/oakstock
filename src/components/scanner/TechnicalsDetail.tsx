"use client";

import { ChevronLeft } from "lucide-react";
import { QUESTRADE_INTERVALS } from "@/utils/constants";
import { Skeleton } from "@/components/ui/skeleton";
import {
  voteColor,
  voteLabel,
  type IndicatorReading,
  type RatingGroup,
  type TechnicalRating,
} from "@/utils/technicalRating";
import { RatingGauge } from "./RatingGauge";

interface TechnicalsDetailProps {
  ticker: string;
  interval: string;
  rating: TechnicalRating | null;
  loading: boolean;
  onIntervalChange: (interval: string) => void;
  onBack: () => void;
}

function CountsRow({ counts }: { counts: RatingGroup["counts"] }) {
  return (
    <div className="mt-3 grid w-full max-w-[280px] grid-cols-3 text-center">
      {(
        [
          ["Sell", counts.sell, "var(--red-primary)"],
          ["Neutral", counts.neutral, "var(--text-tertiary)"],
          ["Buy", counts.buy, "var(--green-primary)"],
        ] as const
      ).map(([label, value, color]) => (
        <div key={label}>
          <div className="text-xs text-text-tertiary">{label}</div>
          <div className="font-financial text-lg" style={{ color }}>
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
    <div className="min-w-0">
      <h3 className="mb-2 font-display text-base text-text-primary">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary text-xs text-text-tertiary">
            <th className="py-2 text-left font-normal">Name</th>
            <th className="py-2 text-right font-normal">Value</th>
            <th className="py-2 text-right font-normal">Action</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.name} className="border-b border-border-secondary">
              <td className="py-2 pr-2 text-text-secondary">{r.name}</td>
              <td className="py-2 text-right font-financial tabular-nums text-text-primary">
                {r.value == null ? "—" : r.value.toFixed(2)}
              </td>
              <td
                className="py-2 pl-2 text-right"
                style={{ color: r.vote ? voteColor(r.vote) : "var(--text-tertiary)" }}
              >
                {r.vote ? voteLabel(r.vote) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  onIntervalChange,
  onBack,
}: TechnicalsDetailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border-primary bg-bg-secondary">
      <div className="flex shrink-0 items-center justify-between border-b border-border-primary px-4 py-3">
        <h2 className="font-display text-base text-text-primary">
          <span className="font-financial">{ticker}</span>
          <span className="text-text-tertiary"> · Technicals</span>
        </h2>
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-full border border-border-primary px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to chart
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-6 flex flex-wrap gap-1">
          {QUESTRADE_INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onIntervalChange(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                opt.value === interval
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : !rating ? (
          <p className="py-12 text-center text-sm text-text-tertiary">
            Not enough history at this interval to rate {ticker}.
          </p>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-3">
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

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
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
