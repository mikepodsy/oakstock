"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnalystDistribution, AnalystFirmRating } from "@/types";
import { distributionRows } from "@/utils/analystRating";
import { formatCurrency } from "@/utils/formatters";

interface RatingDistributionProps {
  distribution: AnalystDistribution | null;
  /** Firm-level detail. Always a subset of the counts — see the note below. */
  firms?: AnalystFirmRating[];
  /** Spot price, to show each target as a move from here. */
  currentPrice?: number | null;
}

function FirmTable({
  firms,
  currentPrice,
}: {
  firms: AnalystFirmRating[];
  currentPrice: number | null | undefined;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[300px] text-xs">
        <thead>
          <tr className="text-[11px] text-text-tertiary">
            <th className="py-1.5 pr-3 text-left font-normal">Firm</th>
            <th className="py-1.5 pr-3 text-right font-normal whitespace-nowrap">
              Target
            </th>
            <th className="py-1.5 text-right font-normal whitespace-nowrap">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {firms.map((f) => {
            const move =
              f.priceTarget != null && currentPrice
                ? (f.priceTarget - currentPrice) / currentPrice
                : null;

            return (
              <tr
                key={`${f.firm}-${f.date}`}
                className="border-t border-border-secondary"
              >
                <td className="py-1.5 pr-3 text-text-secondary">
                  <span className="block truncate">{f.firm}</span>
                  {/* The house's own wording — "Overweight" is not "Buy". */}
                  <span className="block text-[10px] text-text-tertiary">
                    {f.grade}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-financial tabular-nums whitespace-nowrap text-text-primary">
                  {f.priceTarget == null ? (
                    "—"
                  ) : (
                    <>
                      {formatCurrency(f.priceTarget)}
                      {move != null && (
                        <span
                          className="ml-1.5 text-[10px]"
                          style={{
                            color:
                              move >= 0
                                ? "var(--green-primary)"
                                : "var(--red-primary)",
                          }}
                        >
                          {move >= 0 ? "+" : "−"}
                          {Math.abs(move * 100).toFixed(0)}%
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap text-text-tertiary">
                  {f.date}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The recommendation breakdown: one track per bucket, strongest buy first.
 *
 * Bars are scaled against the biggest bucket rather than the analyst total —
 * consensus is usually lopsided, and scaling by total leaves every bar stubby.
 *
 * Each row expands to the firms behind it. Yahoo publishes notes for far fewer
 * analysts than it counts, so an expanded row lists a *subset* of its bucket
 * and says so — it must never read as an enumeration of the count beside it.
 */
export function RatingDistribution({
  distribution,
  firms = [],
  currentPrice,
}: RatingDistributionProps) {
  const [open, setOpen] = useState<string | null>(null);

  const rows = distributionRows(distribution);

  const byBucket = useMemo(() => {
    const map = new Map<string, AnalystFirmRating[]>();
    for (const f of firms) {
      const list = map.get(f.bucket);
      if (list) list.push(f);
      else map.set(f.bucket, [f]);
    }
    return map;
  }, [firms]);

  if (rows.length === 0) return null;

  const namedTotal = firms.length;
  const countedTotal = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => {
        const bucketFirms = byBucket.get(row.key) ?? [];
        const expandable = bucketFirms.length > 0;
        const isOpen = open === row.key;

        return (
          <div key={row.key}>
            <button
              type="button"
              disabled={!expandable}
              aria-expanded={expandable ? isOpen : undefined}
              onClick={() => setOpen(isOpen ? null : row.key)}
              className={`grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-md px-1 py-1 text-left text-xs transition-colors ${
                expandable
                  ? "cursor-pointer hover:bg-bg-tertiary"
                  : "cursor-default"
              }`}
            >
              <span className="whitespace-nowrap text-text-tertiary">
                {row.label}
              </span>

              <span className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{
                    // Zero-count buckets keep their empty track, so the five
                    // rows always line up between symbols.
                    width: `${row.fraction * 100}%`,
                    backgroundColor: row.color,
                  }}
                />
              </span>

              <span className="w-6 whitespace-nowrap text-right font-financial tabular-nums text-text-primary">
                {row.count}
              </span>

              {/* Fixed-width slot whether or not there's a chevron, so the
                  counts stay in one column down the list. */}
              <span className="flex w-4 justify-end">
                {expandable && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </span>
            </button>

            {isOpen && (
              <div className="mb-1 ml-1 mt-1 rounded-lg border border-border-secondary bg-bg-tertiary/40 px-2 py-1">
                <FirmTable firms={bucketFirms} currentPrice={currentPrice} />
              </div>
            )}
          </div>
        );
      })}

      {namedTotal > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
          Firm detail available for {namedTotal} of {countedTotal} analysts —
          Yahoo only publishes notes for some of the ratings it counts. Expand a
          row to see them.
        </p>
      )}
    </div>
  );
}
