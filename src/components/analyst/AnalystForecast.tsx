"use client";

import { RefreshCw } from "lucide-react";
import { RatingGauge } from "@/components/scanner/RatingGauge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalystRatingResult } from "@/hooks/useAnalystRating";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { distributionTotal, targetUpside } from "@/utils/analystRating";
import { formatCurrency } from "@/utils/formatters";
import { EarningsSurpriseChart } from "./EarningsSurpriseChart";
import { EpsChart } from "./EpsChart";
import { FcfChart } from "./FcfChart";
import { PriceTargetChart } from "./PriceTargetChart";
import { RatingDistribution } from "./RatingDistribution";

interface AnalystForecastProps extends AnalystRatingResult {
  ticker: string;
  /**
   * Render the free cash flow chart. Off for the stock page, whose Financials
   * section already charts FCF from the fundamentals feed — two of the same
   * chart on one page is worse than one. Default: true.
   */
  showCashFlow?: boolean;
}

/** History window behind the forecast. The chart projects half of it forward. */
const HISTORY_PERIOD = "2y";

/**
 * Price target, analyst rating and EPS for one symbol — every state included.
 *
 * Shared by the scanner's drill-down (AnalystDetail, which adds a back button)
 * and the stock page (AnalystSection, which adds a heading), so the two can't
 * drift apart.
 */
export function AnalystForecast({
  ticker,
  data,
  score,
  rating,
  loading,
  reason,
  retry,
  showCashFlow = true,
}: AnalystForecastProps) {
  const { history, loading: historyLoading } = usePriceHistory(
    // Don't fetch history for a symbol with nothing to forecast.
    data?.target ? ticker : null,
    HISTORY_PERIOD
  );

  const upside = targetUpside(data?.target?.mean, data?.currentPrice);
  const analysts = distributionTotal(data?.distribution);
  const upColor =
    upside && upside.percent >= 0
      ? "var(--green-primary)"
      : "var(--red-primary)";

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (rating == null || score == null) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary py-16 text-center">
        <p className="text-sm text-text-secondary">
          {reason === "fetch"
            ? `Couldn't load analyst data for ${ticker}.`
            : `No analyst data for ${ticker}.`}
        </p>
        {/* Only a failed request is worth retrying. "No coverage" is a real
            answer — retrying returns the same thing. */}
        {reason === "coverage" && (
          <p className="mx-auto mt-2 max-w-md px-6 text-xs leading-relaxed text-text-tertiary">
            ETFs, indices and currency pairs have no sell-side coverage, and
            neither do delisted or unrecognised symbols.
          </p>
        )}
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* ── Price target ─────────────────────────────────────────────── */}
        {data?.target && (
          <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
            <h3 className="text-sm font-medium text-text-primary">
              Price target
            </h3>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-financial text-3xl text-text-primary">
                {formatCurrency(data.target.mean)}
              </span>
              {data.currency && (
                <span className="text-xs text-text-tertiary">
                  {data.currency}
                </span>
              )}
              {upside && (
                <span
                  className="whitespace-nowrap font-financial text-sm"
                  style={{ color: upColor }}
                >
                  {upside.percent >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(upside.absolute))}{" "}
                  {upside.percent >= 0 ? "+" : "−"}
                  {Math.abs(upside.percent * 100).toFixed(2)}%
                </span>
              )}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {data.target.analystCount
                ? `The ${data.target.analystCount} analysts offering 1-year price forecasts have a max estimate of ${data.target.high.toFixed(2)} and a min estimate of ${data.target.low.toFixed(2)}.`
                : `Analyst 1-year price forecasts range from a min of ${data.target.low.toFixed(2)} to a max of ${data.target.high.toFixed(2)}.`}
            </p>

            <div className="mt-4">
              {historyLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <PriceTargetChart
                  history={history}
                  target={data.target}
                  currentPrice={data.currentPrice}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Analyst rating ───────────────────────────────────────────── */}
        <div className="min-w-0 rounded-xl border border-border-primary bg-bg-secondary p-4">
          <h3 className="text-sm font-medium text-text-primary">
            Analyst rating
          </h3>
          {analysts > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Based on {analysts} analysts giving stock ratings in the past 3
              months.
            </p>
          )}

          <div className="mt-3 flex justify-center">
            <RatingGauge score={score} rating={rating} size="lg" />
          </div>

          <div className="mt-4 border-t border-border-secondary pt-4">
            <RatingDistribution
              distribution={data?.distribution ?? null}
              firms={data?.firms}
              currentPrice={data?.currentPrice}
            />
          </div>
        </div>
      </div>

      {/* ── EPS + free cash flow, beside the beat/miss history ─────────── */}
      {/* Splits later than the row above: a third of the width is under 300px on
          a 1280 laptop, which crams the quarter labels. items-start keeps the
          short earnings card from stretching to the EPS + FCF column. */}
      {data && (
        <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <EpsChart annual={data.eps.annual} quarterly={data.eps.quarterly} />
            {showCashFlow && (
              <FcfChart
                annual={data.freeCashFlow.annual}
                currency={data.currency}
                quarterly={data.freeCashFlow.quarterly}
              />
            )}
          </div>
          <EarningsSurpriseChart quarterly={data.eps.quarterly} />
        </div>
      )}
    </div>
  );
}
